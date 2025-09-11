from rest_framework import serializers
from .models import Conversation, Message, ImageAttachment


class ConversationSerializer(serializers.ModelSerializer):
    message_count = serializers.IntegerField(source='messages.count', read_only=True)
    
    class Meta:
        model = Conversation
        fields = ['id', 'title', 'created_at', 'updated_at', 'system_prompt', 'message_count']
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