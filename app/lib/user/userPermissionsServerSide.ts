import { pathToRegexp } from "path-to-regexp";
import getUserIdServerSide from "./getUserIdServerSide";

// Objeto para permissões de rotas de API (ex: /api/trabalhos/:id)
const permittedRoutesApi: { [key: string]: string[] } = {
    "68f18c51d3440d3001fc4ddc": [ // ID da conta Científica
        '*'
    ],
    "67098341f7397b370e9cb8ba": [ // ID do adm
        '*' // Acesso a todas as APIs
    ]
};

// Objeto para permissões de páginas (rotas visíveis no navegador)
const permittedRoutes: { [key: string]: string[] } = {
    "68f18c51d3440d3001fc4ddc": [ // ID da conta Científica
        '/',
        '/trabalhos', // Acesso a rotas específicas e dinâmicas
        '/usuarios/informacoes/:id'
    ],
    "67098341f7397b370e9cb8ba": [ // id do admin
        "*"
    ]
};


/**
 * @abstract Verifica se o usuário logado tem permissão para acessar uma rota de página ou API.
 * @param url - O objeto URL completo da requisição.
 * @param type - O tipo de rota a ser verificada: 'page' ou 'api'.
 * @returns {Promise<boolean>} - Retorna `true` se o acesso for permitido, `false` caso contrário.
 */
export default async function checkUserPermission(url: URL, type: 'page' | 'api'): Promise<boolean> {
    // 1. Obtém o ID do usuário logado. Se não houver, ele não tem permissão.
    const userIdStr = "68f18c51d3440d3001fc4ddc"//await getUserIdServerSide();
    if (!userIdStr) {
        return false;
    }

    const { pathname } = url;

    // 2. Seleciona o conjunto de regras correto (página ou API) com base no parâmetro 'type'.
    const permissionRules = type === 'page' ? permittedRoutes : permittedRoutesApi;

    // 3. Verifica se o usuário existe na lista de permissões. Se não, acesso negado.
    if (!permissionRules.hasOwnProperty(`${userIdStr}`)) {
        console.log("não possui o id aqui")
        return false;
    }

    // 4. Pega a lista de padrões de rotas permitidas para o usuário.
    const allowedRoutesForUser = permissionRules[`${userIdStr}`];

    // 5. LÓGICA DO WILDCARD: Se a lista de permissões do usuário inclui '*',
    //    conceda acesso total imediatamente.
    if (allowedRoutesForUser.includes('*')) {
        return true;
    }

    // 6. Se não for um superusuário, verifica se a rota atual (pathname)
    //    corresponde a ALGUM dos padrões permitidos.
    const isAllowed = allowedRoutesForUser.some(pattern =>
        pathToRegexp(pattern).regexp.test(pathname)
    );

    return isAllowed;
}