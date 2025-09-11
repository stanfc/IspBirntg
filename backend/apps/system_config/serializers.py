from rest_framework import serializers
from .models import SystemConfig


class SystemConfigSerializer(serializers.ModelSerializer):
    decrypted_value = serializers.CharField(source='get_decrypted_value', read_only=True)
    
    class Meta:
        model = SystemConfig
        fields = ['id', 'config_type', 'key', 'value', 'decrypted_value', 
                 'description', 'is_encrypted', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def to_representation(self, instance):
        """自定義序列化輸出"""
        data = super().to_representation(instance)
        
        # 如果是加密的敏感資訊，在列表檢視中隱藏值
        if instance.is_encrypted and self.context.get('hide_sensitive', False):
            data['value'] = '***'
            data.pop('decrypted_value', None)
        
        return data


class SystemConfigCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemConfig
        fields = ['config_type', 'key', 'value', 'description', 'is_encrypted']
        
    def validate(self, attrs):
        """驗證配置"""
        config_type = attrs.get('config_type')
        key = attrs.get('key')
        value = attrs.get('value')
        
        # 特定配置類型的驗證
        if config_type == 'llm' and key.endswith('_api_key'):
            attrs['is_encrypted'] = True
        
        # 數字配置的驗證
        if key in ['chunk_size', 'chunk_overlap', 'top_k', 'max_tokens', 'max_file_size']:
            try:
                int(value)
            except ValueError:
                raise serializers.ValidationError(f'{key} 必須是有效的數字')
        
        # 溫度參數驗證
        if key == 'temperature':
            try:
                temp = float(value)
                if temp < 0 or temp > 2:
                    raise serializers.ValidationError('temperature 必須在 0-2 之間')
            except ValueError:
                raise serializers.ValidationError('temperature 必須是有效的數字')
        
        return attrs