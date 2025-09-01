export default interface IAcademicWorks {
    _id: string;
    userId: string;
    titulo: string;
    modalidade: string;
    autores: {
        nome: string;
        email: string;
        cpf: string;
        isOrientador: boolean;
        isPagante: boolean;
    }[];
    arquivo: {
        fileId: string;
        fileName: string;
        url: string;
    };
    topicos: {
        intro: string;
        obj: string;
        met: string;
        disc: string;
        conc: string;
        pchave: string;
        ref: string;
    };
    status: "Em Avaliação" | "Aceito" | "Recusado" | "Necessita de Alteração";
    dataSubmissao: string;
    avaliadorComentarios: string;
    dataAvaliacao?: string;
    avaliadorId?: string;
}

