import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const themes = [
  { value: 'light', icon: Sun, label: 'Light', description: 'Light mode for daytime use' },
  { value: 'dark', icon: Moon, label: 'Dark', description: 'Dark mode for low-light environments' },
  { value: 'system', icon: Monitor, label: 'System', description: 'Follows your system preference' },
] as const;

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Theme</CardTitle>
        <CardDescription>Choose your preferred color scheme</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {themes.map((t) => (
            <Button
              key={t.value}
              variant={theme === t.value ? "default" : "outline"}
              className="flex items-center gap-2"
              onClick={() => setTheme(t.value)}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </Button>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          {themes.find(t => t.value === theme)?.description || 'Select a theme'}
        </p>
      </CardContent>
    </Card>
  );
}
