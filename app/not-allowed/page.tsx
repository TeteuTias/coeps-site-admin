import { Ban, Home } from "lucide-react";
import Link from "next/link";
import styles from "@/app/components/CiepsAdmin.module.css";

export default function NotAllowedPage() {
    return (
        <main className={styles.notAllowedPage}>
            <section
                aria-labelledby="not-allowed-title"
                className={styles.notAllowedCard}
            >
                <span className={styles.brandMark}>CIEPS</span>

                <div>
                    <span className={styles.statusBadge}>
                        <Ban aria-hidden="true" size={14} />
                        Acesso restrito
                    </span>
                    <p aria-hidden="true" className={styles.errorCode}>403</p>
                </div>

                <div className={styles.notAllowedIcon}>
                    <Ban aria-hidden="true" size={30} strokeWidth={1.8} />
                </div>

                <h1 className={styles.notAllowedTitle} id="not-allowed-title">
                    Acesso negado
                </h1>
                <p className={styles.notAllowedText}>
                    Sua conta não possui permissão para acessar esta área do painel administrativo.
                </p>

                <Link className={styles.homeLink} href="/">
                    <Home aria-hidden="true" size={18} />
                    Voltar para a página inicial
                </Link>

                <p className={styles.supportText}>
                    Se você acredita que isso é um engano, solicite a revisão do seu perfil ao responsável pelo sistema.
                </p>
            </section>
        </main>
    );
}
