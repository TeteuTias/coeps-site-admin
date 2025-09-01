'use client'
import { useState, useRef } from 'react';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';
import './style.css';

interface ArquivoUpload {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  errorMessage?: string;
}

const SubmeterTrabalhos = () => {
  const [arquivos, setArquivos] = useState<ArquivoUpload[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Função para gerar ID único
  const generateId = () => Math.random().toString(36).substr(2, 9);

  // Função para validar arquivo
  const validarArquivo = (file: File): string | null => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (file.size > maxSize) {
      return 'Arquivo muito grande. Tamanho máximo: 10MB';
    }

    if (!allowedTypes.includes(file.type)) {
      return 'Tipo de arquivo não permitido. Use PDF, DOC, DOCX ou TXT';
    }

    return null;
  };

  // Função para adicionar arquivos
  const adicionarArquivos = (files: FileList | File[]) => {
    const novosArquivos: ArquivoUpload[] = [];
    
    Array.from(files).forEach(file => {
      const erro = validarArquivo(file);
      if (!erro) {
        // Verificar se arquivo já existe
        const jaExiste = arquivos.some(a => a.file.name === file.name && a.file.size === file.size);
        if (!jaExiste) {
          novosArquivos.push({
            file,
            id: generateId(),
            status: 'pending',
            progress: 0
          });
        }
      } else {
        alert(`Erro no arquivo "${file.name}": ${erro}`);
      }
    });

    setArquivos(prev => [...prev, ...novosArquivos]);
  };

  // Handlers para drag and drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      adicionarArquivos(e.dataTransfer.files);
    }
  };

  // Handler para input file
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      adicionarArquivos(e.target.files);
    }
  };

  // Função para remover arquivo
  const removerArquivo = (id: string) => {
    setArquivos(prev => prev.filter(arquivo => arquivo.id !== id));
  };

  // Função para fazer upload de um arquivo
  const uploadArquivo = async (arquivo: ArquivoUpload): Promise<boolean> => {
    const formData = new FormData();
    formData.append('file', arquivo.file);

    try {
      // Atualizar status para uploading
      setArquivos(prev => prev.map(a => 
        a.id === arquivo.id ? { ...a, status: 'uploading', progress: 0 } : a
      ));

      const response = await fetch('/api/post/upload-trabalho', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Erro no upload');
      }

      // Simular progresso (em uma implementação real, você usaria XMLHttpRequest ou similar)
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setArquivos(prev => prev.map(a => 
          a.id === arquivo.id ? { ...a, progress: i } : a
        ));
      }

      // Marcar como sucesso
      setArquivos(prev => prev.map(a => 
        a.id === arquivo.id ? { ...a, status: 'success', progress: 100 } : a
      ));

      return true;
    } catch (error) {
      // Marcar como erro
      setArquivos(prev => prev.map(a => 
        a.id === arquivo.id ? { 
          ...a, 
          status: 'error', 
          progress: 0,
          errorMessage: error instanceof Error ? error.message : 'Erro desconhecido'
        } : a
      ));
      return false;
    }
  };

  // Função para fazer upload de todos os arquivos
  const uploadTodosArquivos = async () => {
    if (arquivos.length === 0) {
      alert('Selecione pelo menos um arquivo para enviar');
      return;
    }

    setUploading(true);
    
    const arquivosPendentes = arquivos.filter(a => a.status === 'pending' || a.status === 'error');
    
    for (const arquivo of arquivosPendentes) {
      await uploadArquivo(arquivo);
    }
    
    setUploading(false);
    
    // Verificar se todos foram enviados com sucesso
    const sucessos = arquivos.filter(a => a.status === 'success').length;
    const total = arquivos.length;
    
    if (sucessos === total) {
      alert('Todos os trabalhos foram enviados com sucesso!');
    } else {
      alert(`${sucessos} de ${total} trabalhos foram enviados com sucesso.`);
    }
  };

  // Função para formatar tamanho do arquivo
  const formatarTamanho = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="submeter-main-container" style={{
      background: 'linear-gradient(135deg, var(--azul) 0%, var(--carmin) 100%) fixed',
      backgroundAttachment: 'fixed',
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat'
    }}>
      <div className="submeter-container">
        <h1 className="submeter-title">SUBMETER TRABALHOS</h1>
        
        <div className="submeter-info">
          <div className="info-card">
            <FileText size={24} />
            <div>
              <h3>Formatos Aceitos</h3>
              <p>PDF, DOC, DOCX, TXT</p>
            </div>
          </div>
          <div className="info-card">
            <Upload size={24} />
            <div>
              <h3>Tamanho Máximo</h3>
              <p>10MB por arquivo</p>
            </div>
          </div>
        </div>

        {/* Área de Upload */}
        <div 
          className={`upload-area ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={48} />
          <h3>Arraste seus arquivos aqui</h3>
          <p>ou clique para selecionar</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
        </div>

        {/* Lista de Arquivos */}
        {arquivos.length > 0 && (
          <div className="arquivos-lista">
            <h3>Arquivos Selecionados ({arquivos.length})</h3>
            
            {arquivos.map(arquivo => (
              <div key={arquivo.id} className="arquivo-item">
                <div className="arquivo-info">
                  <FileText size={20} />
                  <div className="arquivo-detalhes">
                    <span className="arquivo-nome">{arquivo.file.name}</span>
                    <span className="arquivo-tamanho">{formatarTamanho(arquivo.file.size)}</span>
                  </div>
                </div>

                <div className="arquivo-status">
                  {arquivo.status === 'pending' && (
                    <span className="status-pending">Aguardando</span>
                  )}
                  
                  {arquivo.status === 'uploading' && (
                    <div className="upload-progress">
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${arquivo.progress}%` }}
                        ></div>
                      </div>
                      <span>{arquivo.progress}%</span>
                    </div>
                  )}
                  
                  {arquivo.status === 'success' && (
                    <span className="status-success">
                      <CheckCircle size={16} />
                      Enviado
                    </span>
                  )}
                  
                  {arquivo.status === 'error' && (
                    <span className="status-error">
                      <AlertCircle size={16} />
                      Erro
                    </span>
                  )}

                  <button 
                    className="btn-remover"
                    onClick={() => removerArquivo(arquivo.id)}
                    disabled={arquivo.status === 'uploading'}
                  >
                    <X size={16} />
                  </button>
                </div>

                {arquivo.errorMessage && (
                  <div className="error-message">
                    {arquivo.errorMessage}
                  </div>
                )}
              </div>
            ))}

            <div className="acoes-container">
              <button 
                className="btn-upload-todos"
                onClick={uploadTodosArquivos}
                disabled={uploading || arquivos.every(a => a.status === 'success')}
              >
                {uploading ? 'Enviando...' : 'Enviar Todos os Trabalhos'}
              </button>
              
              <button 
                className="btn-limpar"
                onClick={() => setArquivos([])}
                disabled={uploading}
              >
                Limpar Lista
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubmeterTrabalhos;

