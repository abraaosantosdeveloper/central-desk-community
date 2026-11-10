# CentralDesk — design limpo (versão de portfólio)

Front-end do CentralDesk com o design limpo do canvas "CentralDesk — Portfolio (Clean)": fundo branco,
barra lateral cinza-clara, um único azul de destaque e Inter em tudo. A API é a mesma do CentralDesk
(Spring Boot): nenhuma rota nova foi criada.

Stack: Vue 3.5 (Composition API, `<script setup lang="ts">`), TypeScript, Vite 8, Pinia e vue-router,
as mesmas versões do front oficial.

## Rodar em desenvolvimento

```powershell
copy .env.example .env      # ajuste VITE_API_TARGET se o back-end não estiver em localhost:8080
npm install
npm run dev                 # http://localhost:5173
```

O Vite repassa `/api` para o back-end e corrige o caminho dos cookies (`/auth` → `/api/auth`). Para o
navegador, front e API ficam na mesma origem, então os cookies de sessão funcionam sem CORS.

O cadastro é aberto: qualquer domínio de e-mail é aceito (a cópia genérica do back-end também não restringe).

Se o back-end usa `FRONT_BASE_URL` nos e-mails, aponte para `http://localhost:5173` durante o teste.

## Variáveis

| Variável | Onde | Para quê |
|---|---|---|
| `VITE_API_TARGET` | `.env` (dev) | Endereço do back-end para o proxy do Vite |
| `VITE_COMPANY_NAME` | `.env` / build | Nome da empresa na barra lateral (padrão: "Empresa Modelo") |
| `VITE_SUPPORT_TEAM_NAME` | `.env` / build | Nome do setor que atende (precisa ser igual ao do banco para o aviso de aprovação no cadastro; padrão: "TI & Suporte") |
| `API_UPSTREAM` | serviço do front (produção) | Endereço privado do back-end para o nginx |
| `PORT` | serviço do front (produção) | Porta do nginx (padrão 8080) |

As `VITE_*` entram no build: em produção, defina-as no serviço antes do deploy.

## Produção (Railway)

O `Dockerfile` compila com Node 24 e serve o `dist/` com nginx, que repassa `/api` ao back-end
(`nginx/default.conf.template`, igual ao do front oficial, com SSE sem buffer). Depois do primeiro
`npm install`, versione o `package-lock.json`: o build passa a usar `npm ci`.

## Verificações

```powershell
npm run type-check
npm run build
```

## O que cada perfil vê

| Perfil | Telas |
|---|---|
| Colaborador | Início, Notificações, Novo chamado, Meus chamados, Perfil |
| Atendente (setor de atendimento) | + Fila de atendimento e Meus atendimentos (quadro) |
| Coordenador | + Chamados do setor, Painel ao vivo e Métricas do setor |
| Administrador | tudo, + Usuários, Aprovações e Categorias |

O front só esconde o que a pessoa não pode fazer; quem barra é a API.

## Limites conhecidos (dependem do back-end)

- **Notificações:** a API ainda não expõe `/notifications`. A tela mostra o que chega em tempo real
  (chamado novo, mensagem, pedido de entrada) desde que a aba foi aberta. A store `activity` concentra
  isso e pode passar a buscar da API sem mudar as telas.
- **Avaliação do atendimento:** ainda sem endpoint (`POST /tickets/{id}/rating`), então não aparece.
- **Histórico de encerramentos e reaberturas:** a linha do tempo do chamado usa os campos do próprio
  chamado (aberto, responsável atual, encerrado). O motivo de cada reabertura aparece na conversa.
- **Painel ao vivo:** "Chamados por setor" usa as métricas dos últimos 12 meses (limite da API: 366 dias).
