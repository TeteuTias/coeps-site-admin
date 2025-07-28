"use client"

import { useEffect, useState } from "react"
import LoadingModal from "../components/LoadingModal"
import { IPaymentConfig } from "../lib/types/payments/payment.t"
import { IUser } from "../lib/types/user/user.t"
import { useRouter } from "next/navigation"
//
//


type IParcelamento = IPaymentConfig["parcelamentos"][0];

//
//
export default function Page() {
    const [loading, setLoading] = useState<boolean>(true)
    const [paymentData, setPaymentData] = useState<IPaymentConfig | null>(null)
    const [payedUsers, setPayedUsers] = useState<IUser[]>([])
    const [editableParcelamentos, setEditableParcelamentos] = useState<IParcelamento[]>([]);
    // Estados para controlar o modo de edição e os dados do formulário
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [isEditingParcelamentos, setIsEditingParcelamentos] = useState(false);
    const [editableInfo, setEditableInfo] = useState({
        nome: '',
        valorAVista: 0,
    });
    //
    //
    /* Ativa o modo de edição para os parcelamentos */
    const handleActivateEditParcelamentos = () => {
        // Garante que o estado editável está sincronizado com o principal antes de editar
        if (paymentData) {
            setEditableParcelamentos(JSON.parse(JSON.stringify(paymentData.parcelamentos)));
        }
        setIsEditingParcelamentos(true);
    };

    /* Cancela a edição dos parcelamentos, revertendo qualquer alteração */
    const handleCancelParcelamentosEdit = () => {
        setIsEditingParcelamentos(false);
        // Opcional: reverter o estado editável para o estado original, embora não seja estritamente necessário
        // se a re-sincronização for feita ao ativar a edição.
        if (paymentData) {
            setEditableParcelamentos(paymentData.parcelamentos);
        }
    };

    /* Manipula a mudança nos inputs de um parcelamento específico */
    const handleParcelamentoChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const updatedParcelamentos = [...editableParcelamentos];
        updatedParcelamentos[index] = {
            ...updatedParcelamentos[index],
            [name]: parseFloat(value) || 0,
        };
        setEditableParcelamentos(updatedParcelamentos);
    };

    /* Remove um parcelamento da lista editável */
    const handleDeleteParcelamento = (codigoToDelete: number) => {
        const updatedParcelamentos = editableParcelamentos.filter(p => p.codigo !== codigoToDelete);
        setEditableParcelamentos(updatedParcelamentos);
    };

    /* Salva as alterações feitas nos parcelamentos */
    const handleSaveParcelamentos = async () => {
        // AQUI VOCÊ DEVE ADICIONAR A LÓGICA PARA CHAMAR A API
        // Exemplo de como a chamada da API poderia ser:
        try {
            setLoading(true);
            const response = await fetch('/api/put/pagamentos/configuracaoParcelamentos', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ _id: paymentData?._id, parcelamentos: editableParcelamentos }),
            });
            if (!response.ok) throw new Error('Falha ao salvar parcelamentos');

            // Atualiza o estado principal com os dados salvos
            if (paymentData) {
                setPaymentData({ ...paymentData, parcelamentos: editableParcelamentos });
            }
            alert("Alteração feita com sucesso!")
            setIsEditingParcelamentos(false);

        } catch (error) {
            alert("Não foi possível salvar as alterações. Tente novamente.");
            console.error(error);
        } finally {
            setLoading(false);
        }

        // Para demonstração, atualizamos o estado local diretamente:
        console.log("Salvando parcelamentos:", editableParcelamentos);
        if (paymentData) {
            setPaymentData({ ...paymentData, parcelamentos: editableParcelamentos });
        }
        setIsEditingParcelamentos(false);
    };


    //
    //
    const router = useRouter()


    useEffect(() => {
        const fetchData = async () => {
            const data = await fetch("/api/get/pagamentos/configuracaoPagamento")
            if (!data.ok) {
                // Caso ocorra algum erro ao puxar as informações, vamos mostrar isso na tela
                // coloquei um alert, mas se quiser pode criar um modal mais bonito.
                alert("Ocorreu algum erro ao se conectar ao banco de dados. Recarregue a página e tente novamente")
            }
            const fetchedData = await data.json()
            // atualizando paymentData
            setPaymentData(fetchedData)
            // Inicializando o estado editável com os dados recebidos
            setEditableInfo({
                nome: fetchedData.nome,
                valorAVista: fetchedData.valorAVista
            })
            setLoading(false)
        }

        const fetchDataPayedUsers = async () => {
            const data = await fetch("/api/get/pagamentos/listaInscritos/")
            if (!data.ok) {
                // Caso ocorra algum erro ao puxar as informações, vamos mostrar isso na tela
                // coloquei um alert, mas se quiser pode criar um modal mais bonito.
                alert("Ocorreu algum erro ao se conectar ao banco de dados. Recarregue a página e tente novamente")
            }
            // atualizando paymentData
            setPayedUsers(await data.json())
            setLoading(false)
        }

        // Vamos começar puxandos os dados do banco de dados. 
        // A rota devolverá um IPaymentConfig.
        // Este será guardado em paymentData.
        fetchData()
        // Vamos puxar todos os usuário que possuem o status de pago,
        // ou seja: 1
        // Este será guardado em payedUsers
        fetchDataPayedUsers()
    }, [])

    const handleInfoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setEditableInfo(prev => ({
            ...prev,
            // Converte para número se o campo for 'valorAVista'
            [name]: name === 'valorAVista' ? parseFloat(value) || 0 : value
        }));
    };
    /* Alterando os dados das informacoes gerais de pagamentos */
    const handleSaveChanges = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/put/pagamentos/configuracaoGeralPagamento', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...editableInfo, _id: paymentData?._id }),
            });

            if (!response.ok) {
                alert('Ocorreu algum erro ao salvar os dados. Recarregue a página e tente novamente.')
                setLoading(false)
                return;
            };

            const updatedData = await response.json();

            // Atualiza o estado principal com os novos dados confirmados pelo backend
            setPaymentData(prev => ({ ...prev, ...updatedData }));
            setLoading(false)

        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Não foi possível salvar as alterações. Tente novamente.");
        }

        // Para fins de demonstração, atualizamos o estado local diretamente:
        if (paymentData) {
            setPaymentData({ ...paymentData, ...editableInfo });
        }

        // Desativa o modo de edição
        setIsEditingInfo(false);
    };
    /* Cancelando edição de Informações Gerais */
    const handleCancelEdit = () => {
        // Restaura os valores originais
        if (paymentData) {
            setEditableInfo({
                nome: paymentData.nome,
                valorAVista: paymentData.valorAVista
            });
        }
        // Desativa o modo de edição
        setIsEditingInfo(false);
    };

    /* Adiciona uma nova forma de parcelamento à lista editável */
    const handleAddParcelamento = () => {
        // Gera um novo código único, pegando o maior código existente e somando 1.
        const maxCodigo = editableParcelamentos.reduce((max, p) => p.codigo > max ? p.codigo : max, 0);
        const newParcelamento: IParcelamento = {
            codigo: maxCodigo + 1,
            totalParcelas: 2, // valor padrão
            valorCadaParcela: 0, // valor padrão
        };
        setEditableParcelamentos([...editableParcelamentos, newParcelamento]);
    };

    return (
        <>
            { // se estiver carregando
                loading &&
                <LoadingModal />
            }
            {
                // se não estiver carregando...
                !loading && paymentData &&
                <div className="min-h-screen bg-gray-50 text-gray-800">
                    <div className="container mx-auto px-4 py-8">
                        <header className="text-center mb-12">
                            <h1 className="text-5xl font-extrabold text-gray-900 tracking-tight">PAGAMENTOS</h1>
                        </header>

                        <main className="space-y-12">
                            {/* Seção de Informações Gerais */}
                            <section className="w-full bg-white p-8 rounded-xl shadow-lg border border-gray-200">
                                <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">Informações Gerais de Pagamento</h2>

                                {isEditingInfo ? (
                                    // MODO DE EDIÇÃO
                                    <div className="text-center space-y-4 max-w-md mx-auto">
                                        <div>
                                            <label htmlFor="nome" className="block text-lg font-semibold text-gray-700 text-left mb-1">Nome do Lote</label>
                                            <input
                                                type="text"
                                                id="nome"
                                                name="nome"
                                                value={editableInfo.nome}
                                                onChange={handleInfoInputChange}
                                                className="w-full px-4 py-2 text-xl border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="valorAVista" className="block text-lg font-semibold text-gray-700 text-left mb-1">Valor à Vista (R$)</label>
                                            <input
                                                type="number"
                                                id="valorAVista"
                                                name="valorAVista"
                                                value={editableInfo.valorAVista}
                                                onChange={handleInfoInputChange}
                                                className="w-full px-4 py-2 text-xl border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                        <div className="mt-6 flex justify-center gap-4">
                                            <button onClick={handleSaveChanges} className="text-base bg-green-600 hover:bg-green-700 font-bold text-white px-6 py-3 rounded-lg shadow-md transition-transform transform hover:scale-105">
                                                Salvar
                                            </button>
                                            <button onClick={handleCancelEdit} className="text-base bg-gray-500 hover:bg-gray-600 font-bold text-white px-6 py-3 rounded-lg shadow-md transition-transform transform hover:scale-105">
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    // MODO DE VISUALIZAÇÃO
                                    <div className="text-center space-y-4">
                                        <p className="text-xl">
                                            <span className="font-semibold">Nome do Lote:</span> {paymentData.nome}
                                        </p>
                                        <p className="text-xl">
                                            <span className="font-semibold">Valor à Vista:</span> R$ {paymentData.valorAVista.toFixed(2).replace('.', ',')}
                                        </p>
                                        <div className="mt-6">
                                            <button onClick={() => setIsEditingInfo(true)} className="text-base bg-blue-600 hover:bg-blue-700 font-bold text-white px-6 py-3 rounded-lg shadow-md transition-transform transform hover:scale-105">
                                                Alterar Informações
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </section>


                            {/* Seção de Parcelamentos */}
                            <section className="w-full bg-blue-50 p-8 rounded-xl shadow-lg border border-blue-200">
                                <p>OBS.: Explicar em algum lugar que todos os pagamentos já criados anteriormente esperando pagamento terão os valores antigos mantidos, ao menos que sejam cancelados pelo próprio banco.</p>
                                <h2 className="text-3xl font-bold mb-8 text-center text-gray-800">Formas de Parcelamento</h2>

                                {!isEditingParcelamentos ? (
                                    // MODO DE VISUALIZAÇÃO
                                    <>
                                        <div className="flex flex-wrap justify-center gap-8">
                                            {paymentData.parcelamentos.map((payment) => (
                                                <div key={payment.codigo} className="w-full max-w-sm bg-white border border-gray-200 rounded-lg shadow-md p-6 space-y-3">
                                                    <p className="text-sm text-gray-500">
                                                        <span className="font-semibold">Código de segurança:</span> {payment.codigo}
                                                    </p>
                                                    <p className="text-lg">
                                                        <span className="font-semibold">Total de Parcelas:</span> {payment.totalParcelas}x
                                                    </p>
                                                    <p className="text-lg">
                                                        <span className="font-semibold">Valor de Cada Parcela:</span> R$ {payment.valorCadaParcela.toFixed(2).replace('.', ',')}
                                                    </p>
                                                    <p className="text-lg font-bold text-blue-600">
                                                        <span className="font-semibold">Valor Total:</span> R$ {(payment.valorCadaParcela * payment.totalParcelas).toFixed(2).replace('.', ',')}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="text-center mt-8">
                                            <button onClick={handleActivateEditParcelamentos} className="text-base bg-blue-600 hover:bg-blue-700 font-bold text-white px-6 py-3 rounded-lg shadow-md transition-transform transform hover:scale-105">
                                                Alterar Informações
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    // MODO DE EDIÇÃO
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {editableParcelamentos.map((payment, index) => (
                                                <div key={payment.codigo} className="bg-white border border-blue-300 rounded-lg shadow-md p-6 space-y-4 relative">
                                                    <button onClick={() => handleDeleteParcelamento(payment.codigo)} className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white font-bold w-7 h-7 rounded-full flex items-center justify-center shadow-md">&times;</button>
                                                    <div>
                                                        <p className="text-sm text-gray-600"><span className="font-semibold">Código:</span> {payment.codigo}</p>
                                                    </div>
                                                    <div>
                                                        <label htmlFor={`totalParcelas-${payment.codigo}`} className="block text-sm font-semibold text-gray-700 mb-1">Total de Parcelas</label>
                                                        <input
                                                            type="number"
                                                            id={`totalParcelas-${payment.codigo}`}
                                                            name="totalParcelas"
                                                            value={payment.totalParcelas}
                                                            onChange={(e) => handleParcelamentoChange(index, e)}
                                                            className="w-full p-2 border border-gray-300 rounded-md"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label htmlFor={`valorCadaParcela-${payment.codigo}`} className="block text-sm font-semibold text-gray-700 mb-1">Valor por Parcela (R$)</label>
                                                        <input
                                                            type="number"
                                                            id={`valorCadaParcela-${payment.codigo}`}
                                                            name="valorCadaParcela"
                                                            value={payment.valorCadaParcela}
                                                            onChange={(e) => handleParcelamentoChange(index, e)}
                                                            className="w-full p-2 border border-gray-300 rounded-md"
                                                        />
                                                    </div>
                                                    <p className="text-md font-bold text-blue-600 pt-2 border-t mt-4">
                                                        <span className="font-semibold">Novo Valor Total:</span> R$ {(payment.valorCadaParcela * payment.totalParcelas).toFixed(2).replace('.', ',')}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="text-center">
                                            <button onClick={handleAddParcelamento} className="text-base bg-teal-500 hover:bg-teal-600 font-bold text-white px-6 py-3 rounded-lg shadow-md transition-transform transform hover:scale-105">
                                                Adicionar Forma de Pagamento
                                            </button>
                                        </div>
                                        <div className="mt-10 flex justify-center gap-4 border-t border-blue-200 pt-6">
                                            <button onClick={handleSaveParcelamentos} className="text-base bg-green-600 hover:bg-green-700 font-bold text-white px-8 py-3 rounded-lg shadow-md transition-transform transform hover:scale-105">
                                                Salvar Alterações
                                            </button>
                                            <button onClick={handleCancelParcelamentosEdit} className="text-base bg-gray-500 hover:bg-gray-600 font-bold text-white px-8 py-3 rounded-lg shadow-md transition-transform transform hover:scale-105">
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </section>

                            {/* Seção de Estatísticas e Lista de Pagantes */}
                            <section className="w-full bg-gray-100 space-y-5 p-8 rounded-xl shadow-lg border border-gray-200">
                                {/*
                                    Aqui vamos mostrar algumas informações sobre os pagamentos dos usuários;
                                */}
                                <p>Colocar que em algum lugar que esse valor é variável com a quantidade ATUAL de inscrições. Ou seja, inscrições de COEPS passados que foram resetadas não apareceram mais aqui</p>
                                <h2 className="text-3xl font-bold mb-4 text-center text-gray-800">Estatísticas Gerais - Inscrições</h2>
                                <p className="text-2xl text-center mb-10 text-blue-600 font-semibold">
                                    Total de Inscrições: {payedUsers.length > 0 ? payedUsers.length : "Ainda não há inscrições"}
                                </p>

                                <div>
                                    <h3 className="text-3xl font-bold text-center text-gray-800">
                                        Adicionar Pagamento
                                        <p className="text-[10px]">Aqui vamos encaminha o usuário para a página de todos os usuários. Lá ele pode fazer várias coisas, e uma delas é alterar o pagamento.</p>
                                    </h3>
                                    <div className="w-full flex items-center content-center justify-center">
                                        <button className="w-fit px-4 py-1 hover:bg-blue-600 bg-blue-500 text-white font-bold rounded-sm"
                                            onClick={() => router.push("/usuarios/")}
                                        >Ir Para Usuários</button>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-3xl font-bold text-center text-gray-800">
                                        Lista de Pagantes
                                    </h3>
                                    <div className="flex items-center justify-center content-center">
                                        <button
                                            className="w-fit text-sm bg-red-500 hover:bg-red-600 font-bold text-white px-5 py-2.5 rounded-md shadow-sm transition-colors"
                                            onClick={async () => {
                                                setLoading(true)
                                                const data = await fetch(`/api/delete/pagamentos/removerInscricao/ALL`, {
                                                    method: "DELETE"
                                                })

                                                if (!data.ok) {
                                                    alert("Ocorreu algum erro. Recarregue a página e tente novamente.")
                                                    setLoading(false)
                                                    return;
                                                }

                                                // removendo do payedUsers
                                                setPayedUsers([])
                                                setLoading(false)
                                                alert("Todas inscrição foram removidasLista de Pagantes com sucesso!")
                                            }
                                            }>
                                            Remover TODAS Inscrição
                                            <p className="text-[10px]">Se quiser, dá para cirar um modal de confirmação, para previnir que o usuário clique tudo sem querer kakak</p>
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {
                                            /*
                                                Loop ver todos os usuários que realizaram pagamentos;
                                            */
                                            payedUsers.length > 0 ? payedUsers.map((user) => (
                                                <div key={user._id} className="text-base bg-white rounded-lg shadow-md p-6 border border-gray-200 flex flex-col space-y-2 transition-transform transform hover:-translate-y-1 hover:shadow-xl">
                                                    <p><span className="font-semibold">ID Único:</span> <span className="text-gray-600">{user._id}</span></p>
                                                    <p><span className="font-semibold">ID Asaas:</span> <span className="text-gray-600">{user.id_api}</span></p>
                                                    <p><span className="font-semibold">Nome:</span> <span className="text-gray-600">{user.informacoes_usuario.nome}</span></p>
                                                    <p><span className="font-semibold">Email:</span> <span className="text-gray-600">{user.informacoes_usuario.email}</span></p>
                                                    <p><span className="font-semibold">Telefone:</span> <span className="text-gray-600">{user.informacoes_usuario.numero_telefone}</span></p>
                                                    <p><span className="font-semibold">CPF:</span> <span className="text-gray-600">{user.informacoes_usuario.cpf}</span></p>
                                                    <div className="pt-4 mt-auto text-center space-y-2">
                                                        <button
                                                            className="w-full text-sm bg-green-500 hover:bg-green-600 font-bold text-white px-5 py-2.5 rounded-md shadow-sm transition-colors"
                                                            onClick={() => router.push(`/usuarios/informacoes/${user._id} `)}>
                                                            Acessar Perfil
                                                        </button> {/* A rota está em construção */}
                                                        <button
                                                            className="w-full text-sm bg-red-500 hover:bg-red-600 font-bold text-white px-5 py-2.5 rounded-md shadow-sm transition-colors"
                                                            onClick={async () => {
                                                                setLoading(true)
                                                                const data = await fetch(`/api/delete/pagamentos/removerInscricao/${user._id}`, {
                                                                    method: "DELETE"
                                                                })

                                                                if (!data.ok) {
                                                                    alert("Ocorreu algum erro. Recarregue a página e tente novamente.")
                                                                    setLoading(false)
                                                                    return;
                                                                }

                                                                // removendo do payedUsers
                                                                setPayedUsers((prev) => prev.filter((value) => `${value._id}` !== `${user._id}`))
                                                                setLoading(false)
                                                                alert("A inscrição foi removida com sucesso!")
                                                            }
                                                            }>
                                                            Remover Inscrição
                                                            <p className="text-[10px]">Se quiser, dá para cirar um modal de confirmação, para previnir que o usuário clique sem querer</p>
                                                        </button>
                                                    </div>
                                                </div>
                                            )) : (
                                                <p className="col-span-full text-center text-gray-500 text-lg">Nenhum usuário pagante encontrado.</p>
                                            )
                                        }
                                    </div>
                                </div>
                            </section>

                        </main>
                    </div>
                </div>
            }
        </>
    )
}
// antigo