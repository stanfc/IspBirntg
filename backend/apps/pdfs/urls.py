from django.urls import path
from . import views

app_name = 'pdfs'

urlpatterns = [
    path('', views.PDFDocumentListView.as_view(), name='pdf-list'),
    path('upload/', views.PDFUploadView.as_view(), name='pdf-upload'),
    path('<uuid:pk>/', views.PDFDocumentDetailView.as_view(), name='pdf-detail'),
    path('<uuid:pdf_id>/content/', views.pdf_content, name='pdf-content'),
    path('<uuid:pdf_id>/status/', views.pdf_status, name='pdf-status'),
    # 對話相關的 PDF 管理
    path('conversations/<uuid:conversation_id>/add/<uuid:pdf_id>/', 
         views.add_pdf_to_conversation, name='add-pdf-to-conversation'),
    path('conversations/<uuid:conversation_id>/remove/<uuid:pdf_id>/', 
         views.remove_pdf_from_conversation, name='remove-pdf-from-conversation'),
]