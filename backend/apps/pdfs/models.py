import uuid
import os
from django.db import models
from django.conf import settings


class PDFDocument(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    filename = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    upload_time = models.DateTimeField(auto_now_add=True)
    vector_index_path = models.CharField(max_length=500, null=True, blank=True)
    page_count = models.IntegerField(null=True, blank=True)
    file_size = models.BigIntegerField(null=True, blank=True)  # bytes
    
    # 向量化狀態追踪
    VECTORIZATION_STATUS_CHOICES = [
        ('pending', '待處理'),
        ('processing', '處理中'),
        ('completed', '已完成'),
        ('failed', '失敗'),
    ]
    vectorization_status = models.CharField(
        max_length=20,
        choices=VECTORIZATION_STATUS_CHOICES,
        default='pending'
    )
    vectorization_error = models.TextField(null=True, blank=True)
    vectorization_completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'pdf_documents'
        ordering = ['-upload_time']

    def __str__(self):
        return self.filename

    @property
    def file_exists(self):
        """檢查檔案是否存在"""
        return os.path.exists(self.file_path)

    def get_file_size_display(self):
        """格式化檔案大小顯示"""
        if not self.file_size:
            return "Unknown"
        
        for unit in ['B', 'KB', 'MB', 'GB']:
            if self.file_size < 1024.0:
                return f"{self.file_size:.1f} {unit}"
            self.file_size /= 1024.0
        return f"{self.file_size:.1f} TB"
    
    def get_full_text(self):
        """獲取完整 PDF 文字內容"""
        if not self.file_exists:
            return ""
        
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(self.file_path)
            full_text = ""
            
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                full_text += page.get_text() + "\n\n"
            
            doc.close()
            return full_text.strip()
        except Exception as e:
            print(f"讀取 PDF 內容失敗: {e}")
            return ""
    
    def extract_images_with_descriptions(self):
        """提取 PDF 中的圖片並生成描述"""
        if not self.file_exists:
            return []
        
        try:
            from apps.system_config.models import SystemConfig
            config = SystemConfig.get_config()
            
            # 檢查是否啟用圖片處理
            if not getattr(config, 'process_images', False):
                return []
                
            if not config.gemini_api_key:
                return []
            
            import fitz
            import base64
            
            import google.generativeai as genai
            genai.configure(api_key=config.gemini_api_key)
            model = genai.GenerativeModel('gemini-2.5-flash')
            
            doc = fitz.open(self.file_path)
            image_descriptions = []
            
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                image_list = page.get_images()
                
                for img_index, img in enumerate(image_list):
                    try:
                        xref = img[0]
                        pix = fitz.Pixmap(doc, xref)
                        
                        if pix.n - pix.alpha < 4:  # 只處理 RGB/灰階圖片
                            img_data = pix.tobytes("png")
                            
                            # 使用 Gemini Vision 分析圖片
                            response = model.generate_content([
                                "請描述這張圖片的內容，包括主要元素、文字、圖表等資訊。",
                                {"mime_type": "image/png", "data": img_data}
                            ])
                            
                            image_descriptions.append({
                                'page_number': page_num + 1,
                                'image_index': img_index,
                                'description': response.text,
                                'type': 'image'
                            })
                        
                        pix = None
                    except Exception as e:
                        print(f"處理圖片失敗: {e}")
                        continue
            
            doc.close()
            return image_descriptions
            
        except Exception as e:
            print(f"提取圖片失敗: {e}")
            return []
