import fitz  # PyMuPDF
import os
from typing import Dict, List, Optional
from django.conf import settings
from .models import PDFDocument
from apps.rag.services import RAGService


class PDFProcessingService:
    """PDF 處理服務"""
    
    @staticmethod
    def extract_text_from_pdf(pdf_path: str) -> Dict:
        """從 PDF 提取文本內容"""
        try:
            doc = fitz.open(pdf_path)
            pages = []
            total_text = ""
            
            for page_num in range(len(doc)):
                page = doc[page_num]
                text = page.get_text()
                pages.append({
                    'page_number': page_num + 1,
                    'text': text,
                    'char_count': len(text)
                })
                total_text += text + "\n"
            
            doc.close()
            
            return {
                'success': True,
                'page_count': len(pages),
                'pages': pages,
                'total_text': total_text,
                'total_chars': len(total_text)
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def process_pdf_document(pdf_doc: PDFDocument) -> bool:
        """處理 PDF 文檔，提取內容並進行向量化"""
        try:
            # 更新狀態為處理中
            pdf_doc.vectorization_status = 'processing'
            pdf_doc.save()
            
            # 提取文本
            result = PDFProcessingService.extract_text_from_pdf(pdf_doc.file_path)
            
            if result['success']:
                # 更新頁面數量
                pdf_doc.page_count = result['page_count']
                
                # 提取圖片描述
                image_descriptions = pdf_doc.extract_images_with_descriptions()
                
                # 進行向量化
                rag_service = RAGService()
                
                # 為每一頁創建文檔
                all_documents = []
                for page_data in result['pages']:
                    page_text = page_data['text']
                    
                    # 添加該頁的圖片描述
                    page_images = [img for img in image_descriptions if img['page_number'] == page_data['page_number']]
                    for img in page_images:
                        page_text += f"\n\n[圖片 {img['image_index']+1}]: {img['description']}"
                    
                    if page_text.strip():  # 只處理非空頁面
                        metadata = {
                            'pdf_id': str(pdf_doc.id),
                            'filename': pdf_doc.filename,
                            'page_number': page_data['page_number']
                        }
                        docs = rag_service.create_documents_from_text(
                            page_text, metadata
                        )
                        all_documents.extend(docs)
                
                if all_documents:
                    # 創建向量索引
                    index = rag_service.create_vector_index(all_documents)
                    
                    # 保存索引
                    index_filename = f"{pdf_doc.id}.pkl"
                    index_path = settings.VECTOR_STORAGE_ROOT / index_filename
                    
                    if rag_service.save_index(index, str(index_path)):
                        pdf_doc.vector_index_path = str(index_path)
                        pdf_doc.vectorization_status = 'completed'
                        pdf_doc.vectorization_error = None
                    else:
                        pdf_doc.vectorization_status = 'failed'
                        pdf_doc.vectorization_error = '索引保存失敗'
                else:
                    pdf_doc.vectorization_status = 'failed'
                    pdf_doc.vectorization_error = '無有可處理的文本內容'
                
            else:
                pdf_doc.vectorization_status = 'failed'
                pdf_doc.vectorization_error = result['error']
            
            pdf_doc.save()
            return result['success']
            
        except Exception as e:
            pdf_doc.vectorization_status = 'failed'
            pdf_doc.vectorization_error = str(e)
            pdf_doc.save()
            return False