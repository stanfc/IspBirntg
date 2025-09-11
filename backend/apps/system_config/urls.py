from django.urls import path
from . import views

app_name = 'system_config'

urlpatterns = [
    path('', views.SystemConfigListView.as_view(), name='config-list'),
    path('create/', views.SystemConfigCreateView.as_view(), name='config-create'),
    path('config/', views.unified_config_view, name='unified-config'),
    path('init/defaults/', views.initialize_default_configs, name='config-init-defaults'),
    path('llm/test-connection/', views.test_llm_connection, name='config-test-llm'),
    path('<uuid:pk>/', views.SystemConfigDetailView.as_view(), name='config-detail'),
    
    # 依類型管理配置
    path('<str:config_type>/', views.get_config_by_type, name='config-by-type'),
    path('<str:config_type>/<str:key>/', views.update_config_by_key, name='config-update-key'),
]