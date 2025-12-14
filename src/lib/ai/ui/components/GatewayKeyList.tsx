/**
 * Gateway Key List Component
 */

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { 
  MoreHorizontal, 
  Trash2, 
  RefreshCw, 
  Power, 
  PowerOff,
  Copy,
  Check,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { GatewayApiKey, CreateKeyResponse } from '../clients/gateway-keys-client';

export interface GatewayKeyListProps {
  keys: GatewayApiKey[];
  onRevoke: (id: string) => Promise<boolean>;
  onEnable: (id: string) => Promise<boolean>;
  onDisable: (id: string) => Promise<boolean>;
  onRegenerate: (id: string) => Promise<CreateKeyResponse | null>;
}

export function GatewayKeyList({
  keys,
  onRevoke,
  onEnable,
  onDisable,
  onRegenerate,
}: GatewayKeyListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [regeneratedKey, setRegeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const handleRevoke = async () => {
    if (deleteId) {
      await onRevoke(deleteId);
      setDeleteId(null);
    }
  };
  
  const handleRegenerate = async (id: string) => {
    const result = await onRegenerate(id);
    if (result) {
      setRegeneratedKey(result.plainTextKey);
    }
  };
  
  const handleCopy = async () => {
    if (regeneratedKey) {
      await navigator.clipboard.writeText(regeneratedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  const isExpired = (key: GatewayApiKey) => {
    return key.expiresAt && key.expiresAt < Date.now();
  };
  
  const getStatusBadge = (key: GatewayApiKey) => {
    if (isExpired(key)) {
      return <Badge variant="secondary">Expired</Badge>;
    }
    if (!key.enabled) {
      return <Badge variant="outline">Disabled</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };
  
  if (keys.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No API keys created yet. Create one to get started.
      </div>
    );
  }
  
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Usage</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last Used</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.map((key) => (
            <TableRow key={key.id}>
              <TableCell className="font-medium">{key.name}</TableCell>
              <TableCell>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {key.keyPrefix}...
                </code>
              </TableCell>
              <TableCell>{getStatusBadge(key)}</TableCell>
              <TableCell>{key.usageCount.toLocaleString()}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatDistanceToNow(key.createdAt, { addSuffix: true })}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {key.lastUsedAt 
                  ? formatDistanceToNow(key.lastUsedAt, { addSuffix: true })
                  : 'Never'
                }
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {key.enabled ? (
                      <DropdownMenuItem onClick={() => onDisable(key.id)}>
                        <PowerOff className="mr-2 h-4 w-4" />
                        Disable
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => onEnable(key.id)}>
                        <Power className="mr-2 h-4 w-4" />
                        Enable
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleRegenerate(key.id)}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Regenerate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => setDeleteId(key.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Revoke
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The API key will be permanently deleted
              and any applications using it will lose access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} className="bg-destructive">
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Regenerated Key Dialog */}
      <AlertDialog open={!!regeneratedKey} onOpenChange={() => setRegeneratedKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Key Regenerated</AlertDialogTitle>
            <AlertDialogDescription>
              Copy your new API key now. You won't be able to see it again!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 my-4">
            <code className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">
              {regeneratedKey}
            </code>
            <Button variant="outline" size="icon" onClick={handleCopy}>
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction>Done</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
