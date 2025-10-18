from django.urls import path
from . import views
from . import annotation_views

app_name = 'conversations'
# Force reload - updated

urlpatterns = [
    # 對話相關路由
    path('', views.ConversationListCreateView.as_view(), name='conversation-list'),
    path('create/', views.create_conversation, name='create-conversation'),
    path('<uuid:pk>/', views.ConversationDetailView.as_view(), name='conversation-detail'),
    path('<uuid:conversation_id>/update/', views.update_conversation, name='update-conversation'),
    path('<uuid:conversation_id>/messages/', views.conversation_messages, name='conversation-messages'),
    path('<uuid:conversation_id>/chat/', views.chat_with_pdfs, name='chat-with-pdfs'),
    path('<uuid:conversation_id>/chat/stream/', views.chat_with_pdfs_stream, name='chat-with-pdfs-stream'),
    path('<uuid:conversation_id>/add-pdf/', views.add_pdf_to_conversation, name='add-pdf-to-conversation'),
    path('<uuid:conversation_id>/remove-pdf/<uuid:pdf_id>/', views.remove_pdf_from_conversation, name='remove-pdf-from-conversation'),
    path('<uuid:conversation_id>/pdfs/', views.get_conversation_pdfs, name='get-conversation-pdfs'),
    path('<uuid:conversation_id>/move-to-folder/', views.move_conversation_to_folder, name='move-conversation-to-folder'),

    # PDF注释相关路由
    path('<uuid:conversation_id>/pdfs/<uuid:pdf_id>/annotations/', annotation_views.get_pdf_annotations, name='get-pdf-annotations'),
    path('<uuid:conversation_id>/pdfs/<uuid:pdf_id>/annotations/create/', annotation_views.create_pdf_annotation, name='create-pdf-annotation'),
    path('annotations/<uuid:annotation_id>/', annotation_views.update_pdf_annotation, name='update-pdf-annotation'),
    path('annotations/<uuid:annotation_id>/delete/', annotation_views.delete_pdf_annotation, name='delete-pdf-annotation'),

    # PDF阅读状态相关路由
    path('<uuid:conversation_id>/pdfs/<uuid:pdf_id>/reading-state/', annotation_views.get_pdf_reading_state, name='get-pdf-reading-state'),
    path('<uuid:conversation_id>/pdfs/<uuid:pdf_id>/reading-state/save/', annotation_views.save_pdf_reading_state, name='save-pdf-reading-state'),

    # 文件夾相關路由
    path('folders/', views.FolderListCreateView.as_view(), name='folder-list-create'),
    path('folders/<uuid:pk>/', views.FolderDetailView.as_view(), name='folder-detail'),
    path('folders/<uuid:folder_id>/conversations/', views.folder_conversations, name='folder-conversations'),

    # 其他路由
    path('upload-image/', views.upload_image, name='upload-image'),
    path('images/<uuid:image_id>/', views.serve_image, name='serve-image'),
]