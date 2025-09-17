from django.urls import path
from . import views

app_name = 'conversations'

urlpatterns = [
    # 對話相關路由
    path('', views.ConversationListCreateView.as_view(), name='conversation-list'),
    path('create/', views.create_conversation, name='create-conversation'),
    path('<uuid:pk>/', views.ConversationDetailView.as_view(), name='conversation-detail'),
    path('<uuid:conversation_id>/update/', views.update_conversation, name='update-conversation'),
    path('<uuid:conversation_id>/messages/', views.conversation_messages, name='conversation-messages'),
    path('<uuid:conversation_id>/chat/', views.chat_with_pdfs, name='chat-with-pdfs'),
    path('<uuid:conversation_id>/add-pdf/', views.add_pdf_to_conversation, name='add-pdf-to-conversation'),
    path('<uuid:conversation_id>/remove-pdf/<uuid:pdf_id>/', views.remove_pdf_from_conversation, name='remove-pdf-from-conversation'),
    path('<uuid:conversation_id>/pdfs/', views.get_conversation_pdfs, name='get-conversation-pdfs'),
    path('<uuid:conversation_id>/move-to-folder/', views.move_conversation_to_folder, name='move-conversation-to-folder'),

    # 文件夾相關路由
    path('folders/', views.FolderListCreateView.as_view(), name='folder-list-create'),
    path('folders/<uuid:pk>/', views.FolderDetailView.as_view(), name='folder-detail'),
    path('folders/<uuid:folder_id>/conversations/', views.folder_conversations, name='folder-conversations'),

    # 其他路由
    path('upload-image/', views.upload_image, name='upload-image'),
    path('images/<uuid:image_id>/', views.serve_image, name='serve-image'),
]