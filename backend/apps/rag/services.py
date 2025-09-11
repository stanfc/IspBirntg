from llama_index.core import Document, VectorStoreIndex, Settings
from llama_index.core.node_parser import SentenceSplitter
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
import os
import pickle
from typing import List, Dict, Any
from django.conf import settings


class RAGService:
    """RAG 服務 - 處理文檔向量化和查詢"""
    
    def __init__(self):
        # 延遲獲取配置，避免啟動時錯誤
        self.config = None
        self.text_splitter = None
        
    def _init_config(self):
        """延遲初始化配置"""
        if self.config is None:
            from apps.system_config.models import SystemConfig
            self.config = SystemConfig.get_config()
            
            # 設置 embedding 模型
            try:
                Settings.embed_model = HuggingFaceEmbedding(
                    model_name="sentence-transformers/all-MiniLM-L6-v2"
                )
            except Exception as e:
                print(f"Warning: Failed to load embedding model: {e}")
                Settings.embed_model = None
            
            # 設置 Gemini LLM
            if self.config.gemini_api_key:
                try:
                    from llama_index.llms.gemini import Gemini
                    Settings.llm = Gemini(
                        model=self.config.gemini_model,
                        api_key=self.config.gemini_api_key
                    )
                except Exception as e:
                    print(f"Warning: Failed to load Gemini: {e}")
                    Settings.llm = None
            else:
                Settings.llm = None
            
            # 設置文本分塊器
            self.text_splitter = SentenceSplitter(
                chunk_size=self.config.chunk_size,
                chunk_overlap=self.config.chunk_overlap
            )
    
    def create_documents_from_text(self, text: str, metadata: Dict[str, Any] = None) -> List[Document]:
        """從文本創建 LlamaIndex 文檔"""
        self._init_config()
        if not metadata:
            metadata = {}
            
        # 創建文檔
        document = Document(text=text, metadata=metadata)
        
        # 分塊
        nodes = self.text_splitter.get_nodes_from_documents([document])
        
        # 轉換為 Document 對象
        documents = []
        for i, node in enumerate(nodes):
            doc_metadata = {**metadata, 'chunk_id': i}
            documents.append(Document(text=node.text, metadata=doc_metadata))
        
        return documents
    
    def create_vector_index(self, documents: List[Document]) -> VectorStoreIndex:
        """創建向量索引"""
        return VectorStoreIndex.from_documents(documents)
    
    def save_index(self, index: VectorStoreIndex, file_path: str) -> bool:
        """保存索引到文件"""
        try:
            # 確保目錄存在
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            # 保存索引
            with open(file_path, 'wb') as f:
                pickle.dump(index, f)
            return True
        except Exception as e:
            print(f"保存索引失敗: {e}")
            return False
    
    def load_index(self, file_path: str) -> VectorStoreIndex:
        """從文件加載索引"""
        try:
            with open(file_path, 'rb') as f:
                return pickle.load(f)
        except Exception as e:
            print(f"加載索引失敗: {e}")
            return None
    
    def query_index(self, index: VectorStoreIndex, query: str, top_k: int = None) -> List[Dict]:
        """查詢索引"""
        self._init_config()
        try:
            if top_k is None:
                top_k = self.config.top_k
            query_engine = index.as_query_engine(similarity_top_k=top_k)
            response = query_engine.query(query)
            
            # 提取相關文檔片段
            source_nodes = response.source_nodes if hasattr(response, 'source_nodes') else []
            
            results = []
            for node in source_nodes:
                results.append({
                    'text': node.text,
                    'score': node.score if hasattr(node, 'score') else 0.0,
                    'metadata': node.metadata
                })
            
            return results
        except Exception as e:
            print(f"查詢索引失敗: {e}")
            return []
    
    def create_chat_engine(self, index: VectorStoreIndex, chat_mode: str = "context"):
        """創建帶記憶的聊天引擎"""
        self._init_config()
        try:
            return index.as_chat_engine(
                chat_mode=chat_mode,
                similarity_top_k=self.config.top_k,
                system_prompt=self.config.system_prompt
            )
        except Exception as e:
            print(f"創建聊天引擎失敗: {e}")
            return None