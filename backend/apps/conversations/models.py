import uuid
from django.db import models


class Folder(models.Model):
    """文件夹模型，用于组织对话"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'folders'
        ordering = ['name']

    def __str__(self):
        return self.name

    def conversation_count(self):
        return self.conversations.count()


class Conversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    title = models.CharField(max_length=200)
    folder = models.ForeignKey(
        Folder,
        on_delete=models.CASCADE,
        related_name='conversations',
        null=True,
        blank=True,
        help_text="對話所屬的文件夾"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    system_prompt = models.TextField(
        default="你是一個專業的學術助手，專門協助用戶理解和分析 PDF 文件內容。請根據提供的文檔內容準確回答問題，並標註引用來源。",
        help_text="對話的系統提示詞，可自定義 AI 助手的行為"
    )
    pdfs = models.ManyToManyField(
        'pdfs.PDFDocument',
        blank=True,
        help_text="與此對話關聯的 PDF 文檔"
    )

    class Meta:
        db_table = 'conversations'
        ordering = ['-updated_at']

    def __str__(self):
        return self.title
    
    def get_pdf_ids(self):
        return ', '.join([str(pdf.id) for pdf in self.pdfs.all()])
    get_pdf_ids.short_description = 'PDF IDs'
    
    def delete(self, *args, **kwargs):
        # 獲取關聯的 PDF
        pdfs_to_check = list(self.pdfs.all())
        
        # 先刪除對話
        super().delete(*args, **kwargs)
        
        # 檢查每個 PDF 是否還有其他對話關聯
        for pdf in pdfs_to_check:
            if not pdf.conversation_set.exists():
                # 刪除實際檔案
                if pdf.file_exists:
                    import os
                    try:
                        os.remove(pdf.file_path)
                    except OSError:
                        pass
                
                # 刪除向量索引檔案
                if pdf.vector_index_path:
                    try:
                        os.remove(pdf.vector_index_path)
                    except OSError:
                        pass
                
                # 刪除 PDF 記錄
                pdf.delete()


class Citation(models.Model):
    """引用來源模型"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    pdf_document = models.ForeignKey(
        'pdfs.PDFDocument', 
        on_delete=models.CASCADE,
        related_name='citations'
    )
    page_number = models.IntegerField()
    text_content = models.TextField()  # 引用的原文片段
    start_char = models.IntegerField(null=True, blank=True)  # 在頁面中的起始字符位置
    end_char = models.IntegerField(null=True, blank=True)    # 在頁面中的結束字符位置
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'citations'
        unique_together = ['pdf_document', 'page_number', 'start_char', 'end_char']
        ordering = ['pdf_document', 'page_number', 'start_char']

    def __str__(self):
        return f"Citation from {self.pdf_document.filename} - Page {self.page_number}"


class ImageAttachment(models.Model):
    """圖片附件模型"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    filename = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    file_size = models.BigIntegerField()
    mime_type = models.CharField(max_length=100)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'image_attachments'
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return self.filename
    
    @property
    def file_exists(self):
        import os
        return os.path.exists(self.file_path)


class Message(models.Model):
    ROLE_CHOICES = [('user', 'User'), ('assistant', 'Assistant')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    citations = models.ManyToManyField(
        Citation,
        blank=True,
        related_name='messages'
    )
    images = models.ManyToManyField(
        ImageAttachment,
        blank=True,
        related_name='messages'
    )
    timestamp = models.DateTimeField(auto_now_add=True)

    # 可選：保留簡單的 sources 欄位作為備用
    raw_sources = models.JSONField(
        null=True,
        blank=True,
        help_text="原始引用資訊備份"
    )

    class Meta:
        db_table = 'messages'
        ordering = ['timestamp']

    def __str__(self):
        return f"{self.role}: {self.content[:50]}..."


class PDFAnnotation(models.Model):
    """PDF注释模型 - 支持高亮和文字方块"""
    ANNOTATION_TYPE_CHOICES = [
        ('highlight', '高亮'),
        ('text', '文字方块'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='pdf_annotations',
        help_text="所属对话"
    )
    pdf_document = models.ForeignKey(
        'pdfs.PDFDocument',
        on_delete=models.CASCADE,
        related_name='annotations',
        help_text="所属PDF文档"
    )
    annotation_type = models.CharField(
        max_length=20,
        choices=ANNOTATION_TYPE_CHOICES,
        help_text="注释类型"
    )
    page_number = models.IntegerField(help_text="页码")

    # 位置信息 (相对于PDF页面的百分比坐标，0-100)
    x = models.FloatField(help_text="X坐标百分比")
    y = models.FloatField(help_text="Y坐标百分比")
    width = models.FloatField(help_text="宽度百分比")
    height = models.FloatField(help_text="高度百分比")

    # 高亮专用字段
    color = models.CharField(
        max_length=20,
        default='yellow',
        help_text="高亮颜色"
    )

    # 文字方块专用字段
    text_content = models.TextField(
        null=True,
        blank=True,
        help_text="文字方块内容"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'pdf_annotations'
        ordering = ['pdf_document', 'page_number', 'created_at']
        indexes = [
            models.Index(fields=['conversation', 'pdf_document']),
            models.Index(fields=['page_number']),
        ]

    def __str__(self):
        return f"{self.annotation_type} on {self.pdf_document.filename} - Page {self.page_number}"


class PDFReadingState(models.Model):
    """PDF阅读状态 - 记录每个对话中PDF的阅读进度"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='pdf_reading_states',
        help_text="所属对话"
    )
    pdf_document = models.ForeignKey(
        'pdfs.PDFDocument',
        on_delete=models.CASCADE,
        related_name='reading_states',
        help_text="所属PDF文档"
    )

    # 阅读位置
    current_page = models.IntegerField(default=1, help_text="当前页码")
    scroll_position = models.FloatField(
        default=0,
        help_text="滚动位置百分比"
    )

    # 视图状态
    zoom_level = models.FloatField(default=1.0, help_text="缩放级别")

    # 时间戳
    last_read_at = models.DateTimeField(auto_now=True, help_text="最后阅读时间")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pdf_reading_states'
        unique_together = ['conversation', 'pdf_document']
        ordering = ['-last_read_at']
        indexes = [
            models.Index(fields=['conversation', 'pdf_document']),
        ]

    def __str__(self):
        return f"{self.conversation.title} - {self.pdf_document.filename} (Page {self.current_page})"
