"""PDF注释和阅读状态相关的视图"""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from django.shortcuts import get_object_or_404

from .models import Conversation, PDFAnnotation, PDFReadingState
from .serializers import PDFAnnotationSerializer, PDFReadingStateSerializer
from apps.pdfs.models import PDFDocument


# PDF注释相关API

@api_view(['GET'])
def get_pdf_annotations(request, conversation_id, pdf_id):
    """获取指定对话中指定PDF的所有注释"""
    conversation = get_object_or_404(Conversation, id=conversation_id)
    pdf = get_object_or_404(PDFDocument, id=pdf_id)

    annotations = PDFAnnotation.objects.filter(
        conversation=conversation,
        pdf_document=pdf
    ).order_by('page_number', 'created_at')

    return Response(PDFAnnotationSerializer(annotations, many=True).data)


@api_view(['POST'])
def create_pdf_annotation(request, conversation_id, pdf_id):
    """创建PDF注释"""
    conversation = get_object_or_404(Conversation, id=conversation_id)
    pdf = get_object_or_404(PDFDocument, id=pdf_id)

    data = request.data.copy()
    data['conversation'] = str(conversation.id)
    data['pdf_document'] = str(pdf.id)

    serializer = PDFAnnotationSerializer(data=data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PUT'])
def update_pdf_annotation(request, annotation_id):
    """更新PDF注释"""
    annotation = get_object_or_404(PDFAnnotation, id=annotation_id)

    serializer = PDFAnnotationSerializer(annotation, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
def delete_pdf_annotation(request, annotation_id):
    """删除PDF注释"""
    annotation = get_object_or_404(PDFAnnotation, id=annotation_id)
    annotation.delete()
    return Response({'message': '注释已删除'}, status=status.HTTP_204_NO_CONTENT)


# PDF阅读状态相关API

@api_view(['GET'])
def get_pdf_reading_state(request, conversation_id, pdf_id):
    """获取指定对话中指定PDF的阅读状态"""
    conversation = get_object_or_404(Conversation, id=conversation_id)
    pdf = get_object_or_404(PDFDocument, id=pdf_id)

    try:
        reading_state = PDFReadingState.objects.get(
            conversation=conversation,
            pdf_document=pdf
        )
        return Response(PDFReadingStateSerializer(reading_state).data)
    except PDFReadingState.DoesNotExist:
        # 如果不存在，返回默认状态
        return Response({
            'current_page': 1,
            'scroll_position': 0,
            'zoom_level': 1.0
        })


@api_view(['POST', 'PUT'])
def save_pdf_reading_state(request, conversation_id, pdf_id):
    """保存或更新PDF阅读状态"""
    conversation = get_object_or_404(Conversation, id=conversation_id)
    pdf = get_object_or_404(PDFDocument, id=pdf_id)

    reading_state, created = PDFReadingState.objects.get_or_create(
        conversation=conversation,
        pdf_document=pdf,
        defaults={
            'current_page': request.data.get('current_page', 1),
            'scroll_position': request.data.get('scroll_position', 0),
            'zoom_level': request.data.get('zoom_level', 1.0)
        }
    )

    if not created:
        # 更新现有记录
        reading_state.current_page = request.data.get('current_page', reading_state.current_page)
        reading_state.scroll_position = request.data.get('scroll_position', reading_state.scroll_position)
        reading_state.zoom_level = request.data.get('zoom_level', reading_state.zoom_level)
        reading_state.save()

    return Response(PDFReadingStateSerializer(reading_state).data)
