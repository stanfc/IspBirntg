from django.contrib import admin
from .models import Conversation, Message, Folder, PDFAnnotation, PDFReadingState


@admin.register(Folder)
class FolderAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_at', 'updated_at']
    search_fields = ['name']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ['title', 'folder', 'created_at', 'updated_at', 'get_pdf_ids']
    search_fields = ['title']
    list_filter = ['folder']
    readonly_fields = ['id', 'created_at', 'updated_at']
    filter_horizontal = ['pdfs']

    def get_pdf_ids(self, obj):
        return ', '.join([str(pdf.id) for pdf in obj.pdfs.all()])
    get_pdf_ids.short_description = 'PDF IDs'


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['conversation', 'role', 'timestamp']
    list_filter = ['role', 'timestamp']
    readonly_fields = ['id', 'timestamp']


@admin.register(PDFAnnotation)
class PDFAnnotationAdmin(admin.ModelAdmin):
    list_display = ['conversation', 'pdf_document', 'annotation_type', 'page_number', 'created_at']
    list_filter = ['annotation_type', 'page_number']
    search_fields = ['conversation__title', 'pdf_document__filename']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(PDFReadingState)
class PDFReadingStateAdmin(admin.ModelAdmin):
    list_display = ['conversation', 'pdf_document', 'current_page', 'zoom_level', 'last_read_at']
    search_fields = ['conversation__title', 'pdf_document__filename']
    readonly_fields = ['id', 'created_at', 'last_read_at']
