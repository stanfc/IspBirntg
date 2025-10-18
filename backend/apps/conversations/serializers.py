from rest_framework import serializers
from .models import Folder, Conversation, Message, ImageAttachment, PDFAnnotation, PDFReadingState


class FolderSerializer(serializers.ModelSerializer):
    conversation_count = serializers.IntegerField(source='conversations.count', read_only=True)

    class Meta:
        model = Folder
        fields = ['id', 'name', 'created_at', 'updated_at', 'conversation_count']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ConversationSerializer(serializers.ModelSerializer):
    message_count = serializers.IntegerField(source='messages.count', read_only=True)
    folder_name = serializers.CharField(source='folder.name', read_only=True)

    class Meta:
        model = Conversation
        fields = ['id', 'title', 'folder', 'folder_name', 'created_at', 'updated_at', 'system_prompt', 'message_count']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ImageAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImageAttachment
        fields = ['id', 'filename', 'mime_type', 'file_size']

class MessageSerializer(serializers.ModelSerializer):
    images = ImageAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'role', 'content', 'timestamp', 'raw_sources', 'images']
        read_only_fields = ['id', 'timestamp']


class PDFAnnotationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PDFAnnotation
        fields = [
            'id', 'conversation', 'pdf_document', 'annotation_type',
            'page_number', 'x', 'y', 'width', 'height',
            'color', 'text_content', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PDFReadingStateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PDFReadingState
        fields = [
            'id', 'conversation', 'pdf_document',
            'current_page', 'scroll_position', 'zoom_level',
            'last_read_at', 'created_at'
        ]
        read_only_fields = ['id', 'last_read_at', 'created_at']