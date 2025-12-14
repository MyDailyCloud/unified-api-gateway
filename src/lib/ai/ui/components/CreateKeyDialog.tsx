/**
 * Create Key Dialog Component
 */

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus, Copy, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { CreateKeyRequest, CreateKeyResponse } from '../clients/gateway-keys-client';

const createKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name too long'),
  expiresIn: z.string().optional(),
  rateLimit: z.string().optional(),
});

type CreateKeyFormData = z.infer<typeof createKeySchema>;

export interface CreateKeyDialogProps {
  onCreate: (request: CreateKeyRequest) => Promise<CreateKeyResponse | null>;
  trigger?: React.ReactNode;
}

export function CreateKeyDialog({ onCreate, trigger }: CreateKeyDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreateKeyFormData>({
    resolver: zodResolver(createKeySchema),
    defaultValues: {
      expiresIn: 'never',
      rateLimit: '1000',
    },
  });
  
  const onSubmit = async (data: CreateKeyFormData) => {
    setIsLoading(true);
    
    const request: CreateKeyRequest = {
      name: data.name,
      scopes: ['*'],
    };
    
    if (data.expiresIn && data.expiresIn !== 'never') {
      request.expiresIn = parseInt(data.expiresIn);
    }
    
    if (data.rateLimit) {
      request.rateLimit = parseInt(data.rateLimit);
    }
    
    const result = await onCreate(request);
    
    setIsLoading(false);
    
    if (result) {
      setCreatedKey(result.plainTextKey);
    }
  };
  
  const handleCopy = async () => {
    if (createdKey) {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  const handleClose = () => {
    setOpen(false);
    setCreatedKey(null);
    setCopied(false);
    reset();
  };
  
  return (
    <Dialog open={open} onOpenChange={(newOpen) => newOpen ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Key
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {createdKey ? 'API Key Created' : 'Create API Key'}
          </DialogTitle>
          <DialogDescription>
            {createdKey 
              ? 'Copy your API key now. You won\'t be able to see it again!'
              : 'Create a new API key for external access.'
            }
          </DialogDescription>
        </DialogHeader>
        
        {createdKey ? (
          <div className="space-y-4">
            <Alert>
              <AlertTitle>Your API Key</AlertTitle>
              <AlertDescription className="mt-2">
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">
                    {createdKey}
                  </code>
                  <Button variant="outline" size="icon" onClick={handleCopy}>
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground">
              Store this key securely. For security reasons, it cannot be displayed again.
            </p>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Key Name</Label>
              <Input
                id="name"
                placeholder="My API Key"
                disabled={isLoading}
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="expiresIn">Expiration</Label>
              <Select 
                defaultValue="never" 
                onValueChange={(value) => setValue('expiresIn', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select expiration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never expires</SelectItem>
                  <SelectItem value="86400000">1 day</SelectItem>
                  <SelectItem value="604800000">7 days</SelectItem>
                  <SelectItem value="2592000000">30 days</SelectItem>
                  <SelectItem value="31536000000">1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="rateLimit">Rate Limit (requests/hour)</Label>
              <Input
                id="rateLimit"
                type="number"
                placeholder="1000"
                disabled={isLoading}
                {...register('rateLimit')}
              />
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Key'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
