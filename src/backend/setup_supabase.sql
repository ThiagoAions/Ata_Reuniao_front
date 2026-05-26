-- =====================================================
-- Script SQL para configurar a tabela 'colaboradores'
-- no Supabase (cole isso no SQL Editor do Supabase)
-- =====================================================

-- 1. Criar a tabela (caso ainda não exista)
CREATE TABLE IF NOT EXISTS colaboradores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE NOT NULL,
  cargo TEXT,
  encoding TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Habilitar RLS (boa prática de segurança)
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;

-- 3. Criar policies que permitem operações com a chave anon
-- SELECT: Permitir leitura para todos (autenticados ou não)
CREATE POLICY "Permitir leitura pública" ON colaboradores
  FOR SELECT USING (true);

-- INSERT: Permitir inserção para todos
CREATE POLICY "Permitir inserção pública" ON colaboradores
  FOR INSERT WITH CHECK (true);

-- UPDATE: Permitir atualização para todos
CREATE POLICY "Permitir atualização pública" ON colaboradores
  FOR UPDATE USING (true) WITH CHECK (true);

-- DELETE: Permitir exclusão para todos
CREATE POLICY "Permitir exclusão pública" ON colaboradores
  FOR DELETE USING (true);
