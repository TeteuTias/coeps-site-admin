'use client'
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';

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
  data: Usuario[];
}

interface Usuario {
  _id: string,
  name: string,
  description: string,
  participants: string[],
  maxParticipants: number,
}

const PrintableComponent = () => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (printRef.current) {
      const printContent = printRef.current.innerHTML;
      const newWindow = window.open('', '', 'width=800,height=600');
      newWindow?.document.write(`
        <html>
          <head>
            <title>Print</title>
            <style>
              /* Adicione seus estilos personalizados para impressão aqui */
              body { font-family: Arial, sans-serif; }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `);
      newWindow?.document.close();
      newWindow?.focus();
      newWindow?.print();
      newWindow?.close();
    }
  };

  return (
    <div className="p-4">
      <div ref={printRef} className="bg-white p-4 rounded-md shadow-md">
        <h1 className="text-xl font-bold mb-4">Printable Component</h1>
        <p>This is the content that will be printed.</p>
        <ul className="list-disc ml-4">
          <li>Item 1</li>
          <li>Item 2</li>
          <li>Item 3</li>
        </ul>
      </div>
      <button
        onClick={handlePrint}
        className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition"
      >
        Print this Component
      </button>
    </div>
  );
};


const MyComponent = () => {
  const [data, setData] = useState<DataStructure>({
    data: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/get/listaMinicursos');
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
    <div className="p-4 mb-10">
      <div className='flex flex-col items-center'>
        <h1 className="text-xl font-bold text-center" onClick={() => console.log(data)}>Todos Participantes</h1>
        <Link target='_blank' href={`/gerarListaPalestras/`} prefetch={false} className='font-bold cursor-pointer p-[0.5px] bg-blue-600'>GERAR LISTA</Link >
      </div>
      <h1 className="text-xl font-bold text-center" onClick={() => console.log(data)}>Selecione um Minicurso</h1>
      <div className='space-y-5 p-1 flex content-center items-center justify-center'>
        <div className='flex flex-col items-center content-center space-y-3 max-h-screen '>
          {data.data.map((value) => {
            return (
              <div className='bg-white w-1/2 shadow-2xl p-5' key={value._id}>
                <div className='p-[1px] bg-red-400' />
                <p><span className='font-bold'>NOME: </span>{value.name}</p>
                <h1><span className='font-bold'>TOTAL DE VAGAS: </span> {value.maxParticipants}</h1>
                <h1><span className='font-bold'>TOTAL DE INSCRITOS: </span> {value.participants.length}</h1>
                <h1><span className='font-bold'>TOTAL DE VAGAS REMANESCENTES: </span> {value.maxParticipants - value.participants.length}</h1>
                <h1><span className='font-bold'>ID: </span> {value._id}</h1>
                <Link target='_blank' href={`/gerarListaMinicurso/${value._id}`} prefetch={false} className='font-bold cursor-pointer p-1 bg-blue-600'>GERAR LISTA</Link >
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
};

export default MyComponent;
