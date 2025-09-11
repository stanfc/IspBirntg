from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from django.shortcuts import get_object_or_404

from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer
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
    
    if not user_message:
        return Response({'error': '消息不能為空'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # 保存用戶消息
        user_msg = Message.objects.create(
            conversation=conversation,
            role='user',
            content=user_message
        )
        
        # 獲取對話中的所有 PDF
        pdfs = conversation.pdfs.filter(vectorization_status='completed')
        
        if not pdfs.exists():
            return Response({
                'error': '該對話中沒有已完成向量化的 PDF 文檔'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 獲取系統配置
        from apps.system_config.models import SystemConfig
        config = SystemConfig.get_config()
        
        # 初始化 RAG 服務
        rag_service = RAGService()
        
        # 根據 RAG 模式決定處理方式
        if getattr(config, 'rag_enabled', True):
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
                        prompt = f"{config.system_prompt}\n\n相關文檔內容：\n{context}\n\n用戶問題：{user_message}\n\n請根據上述文檔內容回答問題。"
                        
                        response = model.generate_content(prompt)
                        answer = response.text
                    else:
                        answer = "請在設定中配置 Gemini API Key。"
                except Exception as e:
                    print(f"Gemini API 錯誤: {e}")
                    answer = "生成回答時發生錯誤。"
            else:
                answer = "抱歉，在對話的 PDF 中沒有找到相關內容。"
                citations = []
        else:
            # 非 RAG 模式：使用完整 PDF 內容
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
                        
                        prompt = f"{config.system_prompt}\n\n文檔內容：\n{context}\n\n用戶問題：{user_message}"
                        response = model.generate_content(prompt)
                        answer = response.text
                    else:
                        answer = "請在設定中配置 Gemini API Key。"
                except Exception as e:
                    print(f"Gemini API 錯誤: {e}")
                    answer = "生成回答時發生錯誤。"
            else:
                answer = "沒有找到相關文檔內容。"
                citations = []

        
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
    conversation = Conversation.objects.create(title=name)
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