import { IconMoon, IconSun } from "./Icons";

export function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: "dark" | "light";
  onToggle: () => void;
}) {
  const isLight = theme === "light";
  return (
    <button
      type="button"
      className="theme-toggle btn-secondary"
      onClick={onToggle}
      aria-label={isLight ? "Activer le mode nuit" : "Activer le mode jour"}
      title={isLight ? "Mode nuit" : "Mode jour"}
    >
      {isLight ? (
        <>
          <IconMoon className="btn-icon" />
          Mode nuit
        </>
      ) : (
        <>
          <IconSun className="btn-icon" />
          Mode jour
        </>
      )}
    </button>
  );
}
