import React, { useState, useEffect } from 'react';
import { useConfig } from '@/contexts/ConfigContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

const IdentitySettings = () => {
  const { settings, updateSettings, isLoading: isConfigLoading } = useConfig();
  const { user } = useAuth();
  const [institutionName, setInstitutionName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings.institution_name) {
      setInstitutionName(settings.institution_name);
    }
  }, [settings.institution_name]);

  if (isConfigLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  }

  // Access Control
  if (!user || user.username !== 'superadmin') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <ShieldAlert className="h-16 w-16 text-red-500" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Akses Ditolak</h1>
        <p className="text-slate-500 max-w-md">
          Halaman ini hanya dapat diakses oleh Superadmin. Silakan masuk dengan akun yang sesuai.
        </p>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institutionName.trim()) {
      toast.error('Nama Institusi tidak boleh kosong');
      return;
    }

    setIsSaving(true);
    try {
      await updateSettings({ institution_name: institutionName });
      toast.success('Identitas berhasil diperbarui');
    } catch (error) {
      toast.error('Gagal menyimpan perubahan');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Pengaturan Identitas</CardTitle>
          <CardDescription>
            Ubah identitas aplikasi dan nama institusi yang ditampilkan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="institution">Nama Institusi (Medical Center)</Label>
              <Input
                id="institution"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                placeholder="Contoh: RS Harapan Kita"
                className="max-w-md"
              />
              <p className="text-sm text-muted-foreground">
                Nama ini akan muncul di halaman Login dan Footer aplikasi.
              </p>
            </div>

            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Simpan Perubahan
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default IdentitySettings;
