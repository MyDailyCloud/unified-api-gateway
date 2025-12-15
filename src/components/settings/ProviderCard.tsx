import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Loader2, Settings, Trash2, ExternalLink } from 'lucide-react';
import type { ProviderMetadata } from '@/lib/ai/providers-metadata';

interface ProviderCardProps {
  provider: ProviderMetadata;
  hasKey: boolean;
  isValid?: boolean;
  isValidating?: boolean;
  onConfigure: () => void;
  onDelete: () => void;
  onValidate: () => void;
}

export function ProviderCard({
  provider,
  hasKey,
  isValid,
  isValidating,
  onConfigure,
  onDelete,
  onValidate,
}: ProviderCardProps) {
  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-2xl flex-shrink-0">{provider.icon}</div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-foreground truncate">{provider.name}</h3>
                {hasKey && (
                  <Badge 
                    variant={isValid === false ? 'destructive' : isValid === true ? 'default' : 'secondary'}
                    className="flex-shrink-0"
                  >
                    {isValidating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : isValid === true ? (
                      <Check className="h-3 w-3" />
                    ) : isValid === false ? (
                      <X className="h-3 w-3" />
                    ) : (
                      'Configured'
                    )}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">{provider.description}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {provider.docsUrl && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => window.open(provider.docsUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
            
            {hasKey ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onValidate}
                  disabled={isValidating}
                >
                  {isValidating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onConfigure}
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={onConfigure}>
                Configure
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
