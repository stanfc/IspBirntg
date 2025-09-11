from django.contrib import admin
from .models import PDFDocument

@admin.register(PDFDocument)
class PDFDocumentAdmin(admin.ModelAdmin):
    list_display = ['filename', 'upload_time', 'page_count', 'vectorization_status', 'file_size']
    list_filter = ['vectorization_status', 'upload_time']
    search_fields = ['filename']
    readonly_fields = ['id', 'upload_time', 'file_size']
