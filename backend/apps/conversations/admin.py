from django.contrib import admin
from .models import Conversation, Message

@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ['title', 'created_at', 'updated_at', 'get_pdf_ids']
    search_fields = ['title']
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
