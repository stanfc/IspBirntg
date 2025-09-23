from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from django.http import StreamingHttpResponse
import json
import time

from .models import Folder, Conversation, Message, ImageAttachment
from .serializers import FolderSerializer, ConversationSerializer, MessageSerializer
from apps.rag.services import RAGService
from apps.pdfs.models import PDFDocument


class ConversationListCreateView(generics.ListCreateAPIView):
    """對話列表和創建"""
    queryset = Conversation.objects.all()
    serializer_class = ConversationSerializer


class ConversationDetailView(generics.RetrieveUpdateDestroyAPIView):
    """對話詳情、更新和刪除"""
    queryset = Conversation.objects.all()
    serializer_class = ConversationSerializer


@api_view(['POST'])
def chat_with_pdfs(request, conversation_id):
    """與 PDF 進行問答對話"""
    conversation = get_object_or_404(Conversation, id=conversation_id)
    user_message = request.data.get('message', '').strip()
    image_ids = request.data.get('image_ids', [])
    context_mode = request.data.get('context_mode', True)  # 新增 context mode 參數

    if not user_message and not image_ids:
        return Response({'error': '消息和圖片不能同時為空'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # 保存用戶消息
        user_msg = Message.objects.create(
            conversation=conversation,
            role='user',
            content=user_message or '[圖片]'
        )
        
        # 關聯圖片
        if image_ids:
            images = ImageAttachment.objects.filter(id__in=image_ids)
            user_msg.images.set(images)
        
        # 獲取對話中的所有 PDF（僅在啟用 context mode 時檢查）
        if context_mode:
            pdfs = conversation.pdfs.filter(vectorization_status='completed')

            if not pdfs.exists():
                return Response({
                    'error': '該對話中沒有已完成向量化的 PDF 文檔'
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            pdfs = conversation.pdfs.filter(vectorization_status='completed')
        
        # 獲取系統配置
        from apps.system_config.models import SystemConfig
        config = SystemConfig.get_config()
        
        # 初始化 RAG 服務
        rag_service = RAGService()
        
        # 根據 context mode 和 RAG 模式決定處理方式
        if context_mode and pdfs and getattr(config, 'rag_enabled', True):
            # RAG 模式：搜索所有 PDF
            all_results = []
            for pdf in pdfs:
                if pdf.vector_index_path and pdf.file_exists:
                    index = rag_service.load_index(pdf.vector_index_path)
                    if index:
                        results = rag_service.query_index(index, user_message, top_k=config.top_k)
                        all_results.extend(results)
            
            if all_results:
                # 按相關性排序
                all_results.sort(key=lambda x: x.get('score', 0), reverse=True)
                
                # 構建上下文和引用
                context_texts = []
                citations = []
                
                for result in all_results[:5]:
                    context_texts.append(result['text'])
                    citations.append({
                        'pdf_name': result['metadata'].get('filename', '未知文檔'),
                        'page_number': result['metadata'].get('page_number', 1),
                        'text_content': result['text'][:200] + '...' if len(result['text']) > 200 else result['text']
                    })
                
                # 使用 Gemini 生成回答
                try:
                    if config.gemini_api_key:
                        import google.generativeai as genai
                        genai.configure(api_key=config.gemini_api_key)
                        model = genai.GenerativeModel(config.gemini_model)
                        
                        context = "\n\n".join(context_texts[:3])
                        
                        # 準備內容列表
                        content_parts = []
                        
                        # 添加文本提示
                        if user_message:
                            prompt = f"{config.system_prompt}\n\n相關文檔內容：\n{context}\n\n用戶問題：{user_message}\n\n請根據上述文檔內容回答問題。"
                        else:
                            prompt = f"{config.system_prompt}\n\n相關文檔內容：\n{context}\n\n請分析用戶提供的圖片，並結合文檔內容進行說明。"
                        
                        content_parts.append(prompt)
                        
                        # 添加圖片
                        if image_ids:
                            images = ImageAttachment.objects.filter(id__in=image_ids)
                            for image in images:
                                if image.file_exists:
                                    with open(image.file_path, 'rb') as f:
                                        image_data = f.read()
                                    content_parts.append({
                                        "mime_type": image.mime_type,
                                        "data": image_data
                                    })
                        
                        response = model.generate_content(content_parts)
                        answer = response.text
                    else:
                        answer = "請在設定中配置 Gemini API Key。"
                except Exception as e:
                    print(f"Gemini API 錯誤: {e}")
                    answer = "生成回答時發生錯誤。"
            else:
                answer = "抱歉，在對話的 PDF 中沒有找到相關內容。"
                citations = []
        elif context_mode and pdfs and not getattr(config, 'rag_enabled', True):
            # 非 RAG 模式但啟用 context：使用完整 PDF 內容
            all_results = []
            for pdf in pdfs:
                if pdf.file_exists:
                    full_text = pdf.get_full_text()
                    all_results.append({
                        'text': full_text,
                        'score': 1.0,
                        'metadata': {
                            'filename': pdf.filename,
                            'page_number': 1
                        }
                    })

            # 使用 Gemini 生成回答
            if all_results:
                context = "\n\n".join([result['text'][:2000] for result in all_results[:2]])
                citations = [{
                    'pdf_name': result['metadata']['filename'],
                    'page_number': result['metadata']['page_number'],
                    'text_content': result['text'][:200] + '...' if len(result['text']) > 200 else result['text']
                } for result in all_results[:3]]

                try:
                    if config.gemini_api_key:
                        import google.generativeai as genai
                        genai.configure(api_key=config.gemini_api_key)
                        model = genai.GenerativeModel(config.gemini_model)

                        # 準備內容列表
                        content_parts = []

                        if user_message:
                            prompt = f"{config.system_prompt}\n\n文檔內容：\n{context}\n\n用戶問題：{user_message}"
                        else:
                            prompt = f"{config.system_prompt}\n\n文檔內容：\n{context}\n\n請分析用戶提供的圖片，並結合文檔內容進行說明。"

                        content_parts.append(prompt)

                        # 添加圖片
                        if image_ids:
                            images = ImageAttachment.objects.filter(id__in=image_ids)
                            for image in images:
                                if image.file_exists:
                                    with open(image.file_path, 'rb') as f:
                                        image_data = f.read()
                                    content_parts.append({
                                        "mime_type": image.mime_type,
                                        "data": image_data
                                    })

                        response = model.generate_content(content_parts)
                        answer = response.text
                    else:
                        answer = "請在設定中配置 Gemini API Key。"
                except Exception as e:
                    print(f"Gemini API 錯誤: {e}")
                    answer = "生成回答時發生錯誤。"
            else:
                answer = "沒有找到相關文檔內容。"
                citations = []
        else:
            # 關閉 context mode：直接回答用戶問題，不使用 PDF 內容
            citations = []

            try:
                if config.gemini_api_key:
                    import google.generativeai as genai
                    genai.configure(api_key=config.gemini_api_key)
                    model = genai.GenerativeModel(config.gemini_model)

                    # 準備內容列表
                    content_parts = []

                    # 不添加 PDF 內容，只使用基本的系統提示
                    if user_message:
                        prompt = f"{config.system_prompt}\n\n用戶問題：{user_message}\n\n請直接回答問題。"
                    else:
                        prompt = f"{config.system_prompt}\n\n請分析用戶提供的圖片。"

                    content_parts.append(prompt)

                    # 添加圖片
                    if image_ids:
                        images = ImageAttachment.objects.filter(id__in=image_ids)
                        for image in images:
                            if image.file_exists:
                                with open(image.file_path, 'rb') as f:
                                    image_data = f.read()
                                content_parts.append({
                                    "mime_type": image.mime_type,
                                    "data": image_data
                                })

                    response = model.generate_content(content_parts)
                    answer = response.text
                else:
                    answer = "請在設定中配置 Gemini API Key。"
            except Exception as e:
                print(f"Gemini API 錯誤: {e}")
                answer = "生成回答時發生錯誤。"

        
        # 保存 AI 回答
        ai_msg = Message.objects.create(
            conversation=conversation,
            role='assistant',
            content=answer,
            raw_sources=citations  # 暫時保存在 raw_sources 中
        )
        
        return Response({
            'user_message': MessageSerializer(user_msg).data,
            'ai_response': MessageSerializer(ai_msg).data,
            'citations': citations
        })
        
    except Exception as e:
        return Response({
            'error': f'處理消息時發生錯誤: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def chat_with_pdfs_stream(request, conversation_id):
    """與 PDF 進行問答對話 - 串流回應版本"""
    conversation = get_object_or_404(Conversation, id=conversation_id)
    user_message = request.data.get('message', '').strip()
    image_ids = request.data.get('image_ids', [])
    context_mode = request.data.get('context_mode', True)

    if not user_message and not image_ids:
        return Response({'error': '消息和圖片不能同時為空'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        # 保存用戶消息
        user_msg = Message.objects.create(
            conversation=conversation,
            role='user',
            content=user_message or '[圖片]'
        )

        # 關聯圖片
        if image_ids:
            images = ImageAttachment.objects.filter(id__in=image_ids)
            user_msg.images.set(images)

        # 準備context和citations
        citations = []
        context_texts = []

        # 獲取對話中的所有 PDF（僅在啟用 context mode 時檢查）
        if context_mode:
            pdfs = conversation.pdfs.filter(vectorization_status='completed')
            # 如果沒有PDF，改為不使用context mode模式
            if not pdfs.exists():
                context_mode = False
                pdfs = conversation.pdfs.none()  # 空queryset

        # 獲取系統配置
        from apps.system_config.models import SystemConfig
        config = SystemConfig.get_config()

        if context_mode and pdfs.exists():
            # 初始化 RAG 服務
            rag_service = RAGService()

            if pdfs and getattr(config, 'rag_enabled', True):
                # RAG 模式：搜索所有 PDF
                all_results = []
                for pdf in pdfs:
                    if pdf.vector_index_path and pdf.file_exists:
                        index = rag_service.load_index(pdf.vector_index_path)
                        if index:
                            results = rag_service.query_index(index, user_message, top_k=config.top_k)
                            all_results.extend(results)

                if all_results:
                    # 按相關性排序
                    all_results.sort(key=lambda x: x.get('score', 0), reverse=True)

                    # 構建上下文和引用
                    for result in all_results[:5]:
                        context_texts.append(result['text'])
                        citations.append({
                            'pdf_name': result['metadata'].get('filename', '未知文檔'),
                            'page_number': result['metadata'].get('page_number', 1),
                            'text_content': result['text'][:200] + '...' if len(result['text']) > 200 else result['text']
                        })

        def generate_streaming_response():
            """生成串流回應"""
            try:
                if not getattr(config, 'gemini_api_key', None):
                    yield f"data: {json.dumps({'error': '請在設定中配置 Gemini API Key'})}\n\n"
                    return

                import google.generativeai as genai
                genai.configure(api_key=config.gemini_api_key)
                model = genai.GenerativeModel(config.gemini_model)

                # 準備內容
                content_parts = []

                if context_mode and context_texts:
                    context = "\n\n".join(context_texts[:3])
                    if user_message:
                        prompt = f"{config.system_prompt}\n\n相關文檔內容：\n{context}\n\n用戶問題：{user_message}\n\n請根據上述文檔內容回答問題。"
                    else:
                        prompt = f"{config.system_prompt}\n\n相關文檔內容：\n{context}\n\n請分析用戶提供的圖片，並結合文檔內容進行說明。"
                else:
                    if user_message:
                        prompt = f"{config.system_prompt}\n\n用戶問題：{user_message}\n\n請直接回答問題。"
                    else:
                        prompt = f"{config.system_prompt}\n\n請分析用戶提供的圖片。"

                content_parts.append(prompt)

                # 添加圖片
                if image_ids:
                    images = ImageAttachment.objects.filter(id__in=image_ids)
                    for image in images:
                        if image.file_exists:
                            with open(image.file_path, 'rb') as f:
                                image_data = f.read()
                            content_parts.append({
                                "mime_type": image.mime_type,
                                "data": image_data
                            })

                # 發送用戶消息資訊
                yield f"data: {json.dumps({'type': 'user_message', 'message': MessageSerializer(user_msg).data})}\n\n"

                # 發送citations
                if citations:
                    yield f"data: {json.dumps({'type': 'citations', 'citations': citations})}\n\n"

                # 使用 Gemini streaming
                response = model.generate_content(content_parts, stream=True)

                full_content = ""
                for chunk in response:
                    if chunk.text:
                        full_content += chunk.text
                        yield f"data: {json.dumps({'type': 'content', 'content': chunk.text})}\n\n"
                        time.sleep(0.01)  # 避免太快

                # 保存完整的AI回答
                ai_msg = Message.objects.create(
                    conversation=conversation,
                    role='assistant',
                    content=full_content,
                    raw_sources=citations
                )

                # 發送完成信號和AI消息ID
                yield f"data: {json.dumps({'type': 'complete', 'message_id': str(ai_msg.id), 'message': MessageSerializer(ai_msg).data})}\n\n"

            except Exception as e:
                print(f"Streaming error: {e}")
                yield f"data: {json.dumps({'type': 'error', 'error': f'生成回答時發生錯誤: {str(e)}'})}\n\n"

        response = StreamingHttpResponse(
            generate_streaming_response(),
            content_type='text/plain; charset=utf-8'
        )
        response['Cache-Control'] = 'no-cache'
        response['Access-Control-Allow-Origin'] = '*'
        response['Access-Control-Allow-Headers'] = 'Content-Type'
        return response

    except Exception as e:
        return Response({
            'error': f'處理消息時發生錯誤: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def conversation_messages(request, conversation_id):
    """獲取對話的所有消息"""
    conversation = get_object_or_404(Conversation, id=conversation_id)
    messages = conversation.messages.all().order_by('timestamp')
    
    return Response({
        'conversation_id': str(conversation.id),
        'messages': MessageSerializer(messages, many=True).data
    })

@api_view(['POST'])
def create_conversation(request):
    """創建新對話"""
    name = request.data.get('name', '新對話')
    folder_id = request.data.get('folder_id')

    folder = None
    if folder_id:
        folder = get_object_or_404(Folder, id=folder_id)
    else:
        # 默認分配到"未分類"文件夾
        folder, created = Folder.objects.get_or_create(
            name='未分類',
            defaults={'name': '未分類'}
        )

    conversation = Conversation.objects.create(title=name, folder=folder)
    return Response(ConversationSerializer(conversation).data)

@api_view(['PUT'])
def update_conversation(request, conversation_id):
    """更新對話名稱"""
    conversation = get_object_or_404(Conversation, id=conversation_id)
    conversation.title = request.data.get('name', conversation.title)
    conversation.save()
    return Response(ConversationSerializer(conversation).data)

@api_view(['POST'])
def add_pdf_to_conversation(request, conversation_id):
    """將 PDF 添加到對話"""
    conversation = get_object_or_404(Conversation, id=conversation_id)
    pdf_id = request.data.get('pdf_id')
    
    from apps.pdfs.models import PDFDocument
    pdf = get_object_or_404(PDFDocument, id=pdf_id)
    
    conversation.pdfs.add(pdf)
    return Response({'message': 'PDF 已添加到對話'})

@api_view(['DELETE'])
def remove_pdf_from_conversation(request, conversation_id, pdf_id):
    """從對話中移除 PDF"""
    conversation = get_object_or_404(Conversation, id=conversation_id)
    from apps.pdfs.models import PDFDocument
    pdf = get_object_or_404(PDFDocument, id=pdf_id)
    
    conversation.pdfs.remove(pdf)
    return Response({'message': 'PDF 已從對話中移除'})

@api_view(['GET'])
def get_conversation_pdfs(request, conversation_id):
    """獲取對話關聯的 PDF 列表"""
    conversation = get_object_or_404(Conversation, id=conversation_id)
    pdfs = conversation.pdfs.all()
    
    pdf_data = []
    for pdf in pdfs:
        pdf_data.append({
            'id': str(pdf.id),
            'filename': pdf.filename,
            'vectorization_status': pdf.vectorization_status,
            'page_count': pdf.page_count
        })
    
    return Response(pdf_data)

@api_view(['POST'])
def upload_image(request):
    """上傳圖片"""
    if 'image' not in request.FILES:
        return Response({'error': '沒有提供圖片檔案'}, status=400)
    
    image_file = request.FILES['image']
    
    # 驗證檔案類型
    if not image_file.content_type.startswith('image/'):
        return Response({'error': '只支持圖片檔案'}, status=400)
    
    # 驗證檔案大小 (10MB)
    if image_file.size > 10 * 1024 * 1024:
        return Response({'error': '圖片大小不能超過 10MB'}, status=400)
    
    import uuid
    import os
    from django.conf import settings
    
    # 生成唯一檔名
    file_extension = os.path.splitext(image_file.name)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    
    # 確保目錄存在
    image_dir = settings.BASE_DIR / 'data' / 'images'
    os.makedirs(image_dir, exist_ok=True)
    
    file_path = image_dir / unique_filename
    
    # 儲存檔案
    with open(file_path, 'wb+') as destination:
        for chunk in image_file.chunks():
            destination.write(chunk)
    
    # 建立資料庫記錄
    image_attachment = ImageAttachment.objects.create(
        filename=image_file.name,
        file_path=str(file_path),
        file_size=image_file.size,
        mime_type=image_file.content_type
    )
    
    return Response({
        'id': str(image_attachment.id),
        'filename': image_attachment.filename,
        'mime_type': image_attachment.mime_type,
        'file_size': image_attachment.file_size
    })

@api_view(['GET'])
def serve_image(request, image_id):
    """提供圖片檔案"""
    image = get_object_or_404(ImageAttachment, id=image_id)
    
    if not image.file_exists:
        from django.http import Http404
        raise Http404("圖片檔案不存在")
    
    from django.http import FileResponse
    try:
        response = FileResponse(
            open(image.file_path, 'rb'),
            content_type=image.mime_type
        )
        response['Content-Disposition'] = f'inline; filename="{image.filename}"'
        return response
    except FileNotFoundError:
        from django.http import Http404
        raise Http404("圖片檔案不存在")


# Folder相關的視圖

class FolderListCreateView(generics.ListCreateAPIView):
    """文件夾列表和創建"""
    queryset = Folder.objects.all()
    serializer_class = FolderSerializer


class FolderDetailView(generics.RetrieveUpdateDestroyAPIView):
    """文件夾詳情、更新和刪除"""
    queryset = Folder.objects.all()
    serializer_class = FolderSerializer

    def destroy(self, request, *args, **kwargs):
        """刪除文件夾時，將其中的對話移動到"未分類"文件夾"""
        folder = self.get_object()

        # 確保"未分類"文件夾存在
        uncategorized_folder, created = Folder.objects.get_or_create(
            name='未分類',
            defaults={'name': '未分類'}
        )

        # 將此文件夾中的所有對話移動到"未分類"文件夾
        folder.conversations.update(folder=uncategorized_folder)

        # 刪除文件夾
        return super().destroy(request, *args, **kwargs)


@api_view(['GET'])
def folder_conversations(request, folder_id):
    """獲取特定文件夾中的所有對話"""
    folder = get_object_or_404(Folder, id=folder_id)
    conversations = folder.conversations.all().order_by('-updated_at')

    return Response({
        'folder_id': str(folder.id),
        'folder_name': folder.name,
        'conversations': ConversationSerializer(conversations, many=True).data
    })


@api_view(['POST'])
def move_conversation_to_folder(request, conversation_id):
    """將對話移動到指定文件夾"""
    conversation = get_object_or_404(Conversation, id=conversation_id)
    folder_id = request.data.get('folder_id')

    if not folder_id:
        return Response({'error': '需要提供文件夾ID'}, status=status.HTTP_400_BAD_REQUEST)

    folder = get_object_or_404(Folder, id=folder_id)
    conversation.folder = folder
    conversation.save()

    return Response({
        'message': f'對話已移動到文件夾 "{folder.name}"',
        'conversation': ConversationSerializer(conversation).data
    })