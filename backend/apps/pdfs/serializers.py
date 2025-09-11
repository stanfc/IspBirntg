from rest_framework import serializers
from .models import PDFDocument


class PDFDocumentSerializer(serializers.ModelSerializer):
    file_size_display = serializers.CharField(source='get_file_size_display', read_only=True)
    file_exists = serializers.BooleanField(read_only=True)
    conversation_count = serializers.IntegerField(source='conversations.count', read_only=True)
    
    class Meta:
        model = PDFDocument
        fields = ['id', 'filename', 'file_path', 'upload_time', 'page_count', 
                 'file_size', 'file_size_display', 'file_exists', 
                 'vectorization_status', 'vectorization_completed_at',
                 'conversation_count']
        read_only_fields = ['id', 'upload_time', 'vectorization_status', 
                           'vectorization_completed_at']


class PDFUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    filename = serializers.CharField(required=False, allow_blank=True)
        
    def validate_file(self, value):
        """驗證上傳的檔案"""
        if not value.name.lower().endswith('.pdf'):
            raise serializers.ValidationError("只支援 PDF 檔案")
        
        # 檢查檔案大小 (100MB)
        if value.size > 104857600:
            raise serializers.ValidationError("檔案大小不能超過 100MB")
        
        return value