'use client'
import Link from 'next/link';
import { useEffect, useState } from 'react';
interface Document {
  _id: string;
  name: string;
  url: string;
  userId: string;
}

interface User {
  _id: string;
  informacoes_usuario: {
    cpf: string;
    numero_telefone: string;
    nome: string;
    email: string;
    data_criacao: string;
    titulo_honorario: string;
  };
}

interface DataStructure {
  data: Record<string, Document[]>;
  tradutor: Record<string, User>; // Mapeia userId para um único User
}

const MyComponent = () => {
  const [data, setData] = useState<DataStructure>({
    data: {},
    tradutor: {}
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/get/trabalhos');
        if (!response.ok) {
          throw new Error('Erro na resposta da rede');
        }
        const result = await response.json();
        setData(result);
      } catch (error) {
        setError("OCORREU ALGO ERRADO. RECARREGUE");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []); // O array vazio faz com que o efeito execute apenas uma vez ao montar

  if (loading) {
    return <div className="text-center">Carregando...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">TRABALHOS RECEBIDOS</h1>
      <p>Total de Pessoas: {Object.keys(data.data).length}</p>
      <p>Total de Arquivos Recebidos: {Object.keys(data.data).reduce((accumulator, key) => {
        return accumulator + data.data[key].length;
      }, 0)}</p>
      {Object.entries(data.data).map(([userId, documents]) => {
        const userInfo = data.tradutor[userId]; // Acessa o primeiro usuário
        return (
          <div key={userId} className="border p-4 rounded max-w-[100%] overflow-scroll">
            {userInfo ? (
              <>
                <h2 className="font-bold">
                  {userInfo.informacoes_usuario.nome}
                </h2>
                <h3 className="font-bold">
                  {userInfo.informacoes_usuario.numero_telefone}
                </h3>
              </>
            ) : (
              <p>User not found</p>
            )}

            <ul className="list-disc pl-5">
              {documents.map(doc => (
                <li key={doc._id}>
                  <Link target='_blank' href={doc.url} prefetch={true} className="text-blue-500 hover:underline">
                    {doc.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

export default MyComponent;
