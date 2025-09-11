import os
import uuid
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.http import FileResponse, Http404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework.parsers import MultiPartParser, FormParser

from .models import PDFDocument
from .serializers import PDFDocumentSerializer, PDFUploadSerializer
from .services import PDFProcessingService
from apps.conversations.models import Conversation


class PDFDocumentListView(generics.ListAPIView):
    """獲取所有 PDF 文檔列表"""
    queryset = PDFDocument.objects.all()
    serializer_class = PDFDocumentSerializer


class PDFDocumentDetailView(generics.RetrieveDestroyAPIView):
    """獲取或刪除特定 PDF 文檔"""
    queryset = PDFDocument.objects.all()
    serializer_class = PDFDocumentSerializer
    
    def perform_destroy(self, instance):
        # 刪除實際檔案
        if instance.file_exists:
            try:
                os.remove(instance.file_path)
            except OSError:
                pass  # 忽略檔案刪除錯誤
        
        # 刪除資料庫記錄
        instance.delete()


class PDFUploadView(generics.CreateAPIView):
    """上傳 PDF 檔案"""
    serializer_class = PDFUploadSerializer
    parser_classes = (MultiPartParser, FormParser)
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        uploaded_file = serializer.validated_data['file']
        filename = serializer.validated_data.get('filename') or uploaded_file.name
        
        # 生成唯一檔名
        file_extension = os.path.splitext(filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = settings.PDF_STORAGE_ROOT / unique_filename
        
        # 儲存檔案
        with open(file_path, 'wb+') as destination:
            for chunk in uploaded_file.chunks():
                destination.write(chunk)
        
        # 建立資料庫記錄
        pdf_doc = PDFDocument.objects.create(
            filename=filename,
            file_path=str(file_path),
            file_size=uploaded_file.size,
            vectorization_status='pending'
        )
        
        # 如果有指定對話 ID，將 PDF 關聯到該對話
        conversation_id = request.data.get('conversation_id')
        if conversation_id:
            try:
                conversation = Conversation.objects.get(id=conversation_id)
                conversation.pdfs.add(pdf_doc)
            except Conversation.DoesNotExist:
                pass
        
        # 觸發 PDF 內容解析
        PDFProcessingService.process_pdf_document(pdf_doc)
        
        # 返回響應
        return Response({
            'id': str(pdf_doc.id),
            'filename': pdf_doc.filename,
            'file_size': pdf_doc.file_size,
            'upload_time': pdf_doc.upload_time.isoformat(),
            'vectorization_status': pdf_doc.vectorization_status
        }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def add_pdf_to_conversation(request, conversation_id, pdf_id):
    """將 PDF 加入對話"""
    conversation = get_object_or_404(Conversation, id=conversation_id)
    pdf_doc = get_object_or_404(PDFDocument, id=pdf_id)
    
    conversation.pdfs.add(pdf_doc)
    
    return Response({
        'message': f'PDF "{pdf_doc.filename}" 已加入對話 "{conversation.title}"'
    })


@api_view(['DELETE'])
def remove_pdf_from_conversation(request, conversation_id, pdf_id):
    """從對話中移除 PDF"""
    conversation = get_object_or_404(Conversation, id=conversation_id)
    pdf_doc = get_object_or_404(PDFDocument, id=pdf_id)
    
    conversation.pdfs.remove(pdf_doc)
    
    return Response({
        'message': f'PDF "{pdf_doc.filename}" 已從對話 "{conversation.title}" 中移除'
    })


@api_view(['GET'])
def pdf_content(request, pdf_id):
    """獲取 PDF 檔案內容（用於下載或檢視）"""
    pdf_doc = get_object_or_404(PDFDocument, id=pdf_id)
    
    if not pdf_doc.file_exists:
        raise Http404("PDF 檔案不存在")
    
    try:
        response = FileResponse(
            open(pdf_doc.file_path, 'rb'),
            content_type='application/pdf'
        )
        response['Content-Disposition'] = f'inline; filename="{pdf_doc.filename}"'
        response['Access-Control-Allow-Origin'] = '*'
        return response
    except FileNotFoundError:
        raise Http404("PDF 檔案不存在")


@api_view(['GET'])
def pdf_status(request, pdf_id):
    """獲取 PDF 解析狀態"""
    pdf_doc = get_object_or_404(PDFDocument, id=pdf_id)
    
    return Response({
        'id': str(pdf_doc.id),
        'filename': pdf_doc.filename,
        'vectorization_status': pdf_doc.vectorization_status,
        'page_count': pdf_doc.page_count,
        'vectorization_error': pdf_doc.vectorization_error,
        'vectorization_completed_at': pdf_doc.vectorization_completed_at
    })


