import React from "react";
import {
  GraduationCap,
  BookOpen,
  Laptop,
  FlaskConical,
  Wrench,
  Hammer,
  Brain,
  Globe,
  Palette,
  Calculator,
  Mic,
  Music,
  Code,
} from "lucide-react";

type RenderProps = { size?: number; className?: string };

/**
 * Mapeia um emoji comum para um ícone Lucide equivalente.
 * Se não houver correspondência, usa GraduationCap como padrão.
 */
export function renderEmojiAsLucide(emojiRaw: string | undefined | null, props: RenderProps = {}) {
  const { size = 40, className } = props;
  const emoji = (emojiRaw || "").trim();

  const mapping: Record<string, React.ReactElement> = {
    "🎓": <GraduationCap size={size} className={className} />, // educação
    "📚": <BookOpen size={size} className={className} />, // leitura/estudo
    "💻": <Laptop size={size} className={className} />, // tecnologia
    "🧪": <FlaskConical size={size} className={className} />, // laboratório
    "🔬": <FlaskConical size={size} className={className} />, // microscópio → aproximação
    "🛠️": <Hammer size={size} className={className} />, // ferramentas
    "🔧": <Wrench size={size} className={className} />,
    "🧠": <Brain size={size} className={className} />, // neuro/psicologia
    "🌐": <Globe size={size} className={className} />, // web/mundo
    "🌎": <Globe size={size} className={className} />, // variante
    "🎨": <Palette size={size} className={className} />, // artes
    "🧮": <Calculator size={size} className={className} />, // matemática
    "🎤": <Mic size={size} className={className} />, // palestras
    "🎵": <Music size={size} className={className} />, // música
    "🖥️": <Laptop size={size} className={className} />, // desktop → laptop
    "👨‍💻": <Laptop size={size} className={className} />, // dev
    "👩‍💻": <Laptop size={size} className={className} />, // dev
    "⌨️": <Code size={size} className={className} />, // código
  };

  // Alguns emojis vêm com variation selectors; tentamos uma normalização simples
  const normalized = emoji.replace(/\uFE0F/g, "");

  if (mapping[emoji]) return mapping[emoji];
  if (mapping[normalized]) return mapping[normalized];

  return <GraduationCap size={size} className={className} />;
}


