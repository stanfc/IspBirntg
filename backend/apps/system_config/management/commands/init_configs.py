from django.core.management.base import BaseCommand
from apps.system_config.models import SystemConfig, DEFAULT_CONFIGS


class Command(BaseCommand):
    help = '初始化預設系統配置'

    def handle(self, *args, **options):
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
                    self.stdout.write(
                        self.style.SUCCESS(f'建立配置: {config_type}.{key}')
                    )
                else:
                    self.stdout.write(
                        self.style.WARNING(f'配置已存在，跳過: {config_type}.{key}')
                    )
        
        self.stdout.write(
            self.style.SUCCESS(f'完成！共建立 {created_count} 個預設配置')
        )