'use client'
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';

interface DataStructure {
    data: string[];
}

interface Usuario {
    informacoes_usuario: {

        cpf: string,
        data_criacao: string,
        email: string,
        nome: string,
        numero_telefone: string,
        titulo_honorario: string
    }
}

const MyComponent = ({ params }: { params: { _id: string } }) => {
    const [data, setData] = useState<string[]>(
        [],
    );
    const [data2, setData2] = useState<Usuario[]>([])
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>("");

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(`/api/get/participantesMinicursos/${params._id}`);
                if (!response.ok) {
                    throw new Error('Erro na resposta da rede');
                }
                const result: { data: string[] } = await response.json();
                setData(result.data);

                try {
                    const response = await fetch("/api/post/informacoesVariosUsuarios", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(result.data), // Enviando a lista como um corpo JSON
                    });

                    if (!response.ok) {
                        throw new Error("Erro na resposta da API");
                    }

                    const result2: { data: Usuario[] } = await response.json();
                    setData2(result2.data)
                    //setResult(data);
                    //setError(null);
                } catch (err) {
                    setError("Erro ao enviar a lista para a API");
                }



            } catch (error) {
                console.log(error)
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
        <div className="min-h-screen flex flex-col">
            <div className="overflow-auto flex-grow">
                <table className="min-w-full table-auto border-collapse border border-gray-200">
                    <thead>
                        <tr className="bg-gray-200">
                            <th className="p-4 border border-gray-300 w-1/4">
                                <div className='p-[0.5px] bg-black mt-10' />
                                <h1 className='text-[10px]'>ESCREVA O NOME DO MINICURSO AQUI.</h1>

                            </th>
                            <th className="p-4 border border-gray-300 w-1/6">{new Date().toDateString()}</th>
                            <th className="p-4 border border-gray-300 w-1/2">{new Date().toTimeString()}</th>
                        </tr>
                    </thead>
                    <thead>
                        <tr className="bg-gray-200">
                            <th className="p-4 border border-gray-300 w-1/4">Nome</th>
                            <th className="p-4 border border-gray-300 w-1/6">Email</th>
                            <th className="p-4 border border-gray-300 w-1/2">Assinatura</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data2.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-100 " onClick={() => console.log(item)}>
                                <td className="flex flex-row p-4 border border-gray-300 text-black">
                                    <p className='text-[10px]  p-1'>
                                        {index + 1}
                                    </p>
                                    <p>
                                        {item.informacoes_usuario.nome}
                                    </p>

                                </td>
                                <td className="p-4 border border-gray-300 text-black">{item.informacoes_usuario.email}</td>
                                <td className="p-4 border border-gray-300 text-black"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default MyComponent;
