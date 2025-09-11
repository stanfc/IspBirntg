from django.contrib import admin
from .models import SystemConfig

@admin.register(SystemConfig)
class SystemConfigAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'gemini_model', 'updated_at']
    readonly_fields = ['id', 'created_at', 'updated_at']
    
    fieldsets = (
        ('LLM 配置', {
            'fields': ('gemini_api_key', 'gemini_model', 'system_prompt')
        }),
        ('RAG 配置', {
            'fields': ('rag_enabled', 'chunk_size', 'chunk_overlap', 'top_k')
        }),
        ('系統配置', {
            'fields': ('max_file_size',)
        }),
        ('系統信息', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    
    def has_add_permission(self, request):
        # 只允許一個配置實例
        return not SystemConfig.objects.exists()
    
    def has_delete_permission(self, request, obj=None):
        # 不允許刪除配置
        return False
