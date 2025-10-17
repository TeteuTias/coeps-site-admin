// app/not-allowed/page.tsx (ou pages/not-allowed.tsx)

import { Ban, Home } from 'lucide-react';
import Link from 'next/link';
import { type FC } from 'react';

/**
 * Componente da Página "Não Permitido" (403 Forbidden)
 * Design moderno e minimalista com Tailwind CSS e ícone Lucide.
 */
const NotAllowedPage: FC = () => {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8 transition-colors duration-500 py-[100px]">
            <div className="max-w-md w-full space-y-8 text-center bg-white dark:bg-gray-800 p-8 sm:p-12 rounded-xl shadow-2xl transition-all duration-500 transform hover:scale-[1.02]">

                {/* Ícone de Proibido (Ban) */}
                <div className="flex justify-center">
                    <Ban
                        className="w-24 h-24 text-red-500 dark:text-red-400 animate-pulse-slow"
                        strokeWidth={1.5}
                        aria-hidden="true"
                    />
                </div>

                {/* Título Principal */}
                <h1 className="mt-6 text-6xl font-extrabold text-gray-900 dark:text-white tracking-tight sm:text-7xl">
                    403
                </h1>

                {/* Mensagem de Erro */}
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
                    Acesso Negado
                </h2>
                <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
                    Desculpe, você não tem permissão para acessar esta página.
                </p>

                {/* Botão de Navegação */}
                <div className="mt-6">
                    <Link
                        href="/"
                        className="group relative w-full flex justify-center py-3 px-6 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-300 shadow-md hover:shadow-lg"
                    >
                        <Home className="w-5 h-5 mr-2" aria-hidden="true" />
                        Voltar para a Página Inicial
                    </Link>
                </div>

                {/* Link de Suporte/Contato (Opcional) */}
                <div className="text-center mt-4">
                    <a
                        className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm transition-colors duration-200"
                    >
                        Se você acha que é um erro, entre em contato com o suporte.
                    </a>
                </div>
            </div>
        </div>
    );
};

export default NotAllowedPage;

// Se você quiser um efeito sutil no ícone, adicione esta animação no seu CSS global (globals.css):
/*
@keyframes pulse-slow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.animate-pulse-slow {
  animation: pulse-slow 3s infinite ease-in-out;
}
*/