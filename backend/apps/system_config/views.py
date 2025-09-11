from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from django.shortcuts import get_object_or_404

from .models import SystemConfig
from .serializers import SystemConfigSerializer, SystemConfigCreateUpdateSerializer

# 預設配置
DEFAULT_CONFIGS = {
    'llm': {
        'gemini_api_key': '',
        'gemini_model': 'gemini-2.5-flash',
        'system_prompt': '你是一個專業的 AI 助手，請根據提供的文檔內容回答問題。',
        'max_tokens': '1000',
        'temperature': '0.7'
    },
    'rag': {
        'chunk_size': '1000',
        'chunk_overlap': '200',
        'similarity_threshold': '0.7'
    }
}


class SystemConfigListView(generics.ListAPIView):
    """獲取所有系統配置"""
    serializer_class = SystemConfigSerializer
    
    def get_queryset(self):
        config_type = self.request.query_params.get('type')
        if config_type:
            return SystemConfig.objects.filter(config_type=config_type)
        return SystemConfig.objects.all()
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        # 在列表檢視中隱藏敏感資訊
        context['hide_sensitive'] = True
        return context


class SystemConfigDetailView(generics.RetrieveUpdateDestroyAPIView):
    """獲取、更新或刪除特定配置"""
    queryset = SystemConfig.objects.all()
    
    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return SystemConfigCreateUpdateSerializer
        return SystemConfigSerializer


class SystemConfigCreateView(generics.CreateAPIView):
    """建立新配置"""
    serializer_class = SystemConfigCreateUpdateSerializer
    
    def create(self, request, *args, **kwargs):
        # 檢查是否已存在相同的 config_type + key
        config_type = request.data.get('config_type')
        key = request.data.get('key')
        
        if SystemConfig.objects.filter(config_type=config_type, key=key).exists():
            return Response(
                {'error': f'配置 {config_type}.{key} 已存在，請使用更新操作'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return super().create(request, *args, **kwargs)


@api_view(['GET'])
def get_config_by_type(request, config_type):
    """依配置類型獲取所有配置"""
    configs = SystemConfig.objects.filter(config_type=config_type)
    
    # 組織成字典格式
    config_dict = {}
    for config in configs:
        if config.is_encrypted:
            # 對加密配置返回遮罩值
            config_dict[config.key] = '***'
        else:
            config_dict[config.key] = config.value
    
    return Response({
        'config_type': config_type,
        'configs': config_dict
    })


@api_view(['PUT'])
def update_config_by_key(request, config_type, key):
    """更新特定配置項"""
    try:
        config = SystemConfig.objects.get(config_type=config_type, key=key)
    except SystemConfig.DoesNotExist:
        # 如果不存在，建立新的
        config = SystemConfig(config_type=config_type, key=key)
    
    serializer = SystemConfigCreateUpdateSerializer(config, data=request.data, partial=True)
    if serializer.is_valid():
        # 確保 config_type 和 key 不變
        serializer.validated_data['config_type'] = config_type
        serializer.validated_data['key'] = key
        serializer.save()
        return Response(SystemConfigSerializer(config).data)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def initialize_default_configs(request):
    """初始化預設配置"""
    created_count = 0
    
    for config_type, configs in DEFAULT_CONFIGS.items():
        for key, value in configs.items():
            # 檢查是否已存在
            if not SystemConfig.objects.filter(config_type=config_type, key=key).exists():
                # 判斷是否需要加密
                is_encrypted = key.endswith('_api_key') or key.endswith('_key')
                
                SystemConfig.objects.create(
                    config_type=config_type,
                    key=key,
                    value=str(value),
                    is_encrypted=is_encrypted,
                    description=f"預設 {config_type} 配置"
                )
                created_count += 1
    
    return Response({
        'message': f'成功建立 {created_count} 個預設配置',
        'created_count': created_count
    })


@api_view(['POST'])
def test_llm_connection(request):
    """測試 LLM API 連線"""
    provider = request.data.get('provider', 'gemini')
    
    # TODO: 實際測試 API 連線的邏輯將在 llm_integration app 中實現
    
    return Response({
        'status': 'pending',
        'message': f'{provider} 連線測試功能正在開發中'
    })

@api_view(['GET', 'POST'])
def unified_config_view(request):
    """統一配置管理 API"""
    if request.method == 'GET':
        config = SystemConfig.get_config()
        
        flat_config = {
            'gemini_api_key': config.gemini_api_key,
            'gemini_model': config.gemini_model,
            'system_prompt': config.system_prompt,
            'max_tokens': 1000,
            'temperature': 0.7,
            'chunk_size': config.chunk_size,
            'chunk_overlap': config.chunk_overlap,
            'top_k': config.top_k,
            'similarity_threshold': 0.7,
            'rag_enabled': getattr(config, 'rag_enabled', True)
        }
        return Response(flat_config)
    
    elif request.method == 'POST':
        data = request.data
        config = SystemConfig.get_config()
        
        # 更新配置
        config.gemini_api_key = data.get('gemini_api_key', config.gemini_api_key)
        config.gemini_model = data.get('gemini_model', config.gemini_model)
        config.system_prompt = data.get('system_prompt', config.system_prompt)
        config.chunk_size = data.get('chunk_size', config.chunk_size)
        config.chunk_overlap = data.get('chunk_overlap', config.chunk_overlap)
        config.top_k = data.get('top_k', config.top_k)
        
        config.rag_enabled = data.get('rag_enabled', getattr(config, 'rag_enabled', True))
        
        config.save()
        
        return Response({'status': 'success', 'message': '配置已更新'})
