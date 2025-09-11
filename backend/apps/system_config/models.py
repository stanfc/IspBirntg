from django.db import models
import uuid


class SystemConfig(models.Model):
    """系統配置模型 - 單例模式"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    
    # LLM 配置
    gemini_api_key = models.CharField(max_length=200, blank=True, help_text="Gemini API Key")
    gemini_model = models.CharField(max_length=100, default="gemini-pro", help_text="Gemini 模型名稱")
    system_prompt = models.TextField(
        default="你是一個專業的學術助手，專門協助用戶理解和分析 PDF 文件內容。請根據提供的文檔內容準確回答問題，並標註引用來源。",
        help_text="系統提示詞"
    )
    
    # RAG 配置
    chunk_size = models.IntegerField(default=1024, help_text="文本分塊大小")
    chunk_overlap = models.IntegerField(default=200, help_text="分塊重疊大小")
    top_k = models.IntegerField(default=5, help_text="檢索結果數量")
    rag_enabled = models.BooleanField(default=True, help_text="是否啟用 RAG 模式")
    process_images = models.BooleanField(default=False, help_text="是否處理 PDF 中的圖片")
    
    # 其他配置
    max_file_size = models.BigIntegerField(default=104857600, help_text="最大文件大小 (bytes)")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "系統配置"
        verbose_name_plural = "系統配置"
    
    def save(self, *args, **kwargs):
        # 確保只有一個配置實例
        if not self.pk and SystemConfig.objects.exists():
            # 如果已經存在，更新第一個實例
            existing = SystemConfig.objects.first()
            self.pk = existing.pk
        super().save(*args, **kwargs)
    
    @classmethod
    def get_config(cls):
        """獲取系統配置"""
        if cls.objects.exists():
            return cls.objects.first()
        else:
            return cls.objects.create(
                gemini_model='gemini-pro',
                system_prompt='你是一個專業的學術助手，專門協助用戶理解和分析 PDF 文件內容。請根據提供的文檔內容準確回答問題，並標註引用來源。',
                chunk_size=1024,
                chunk_overlap=200,
                top_k=5,
                rag_enabled=True,
                max_file_size=104857600,
            )
    
    def __str__(self):
        return f"系統配置 (更新時間: {self.updated_at.strftime('%Y-%m-%d %H:%M')})"