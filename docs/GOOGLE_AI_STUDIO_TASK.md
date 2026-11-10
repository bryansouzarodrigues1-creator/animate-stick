# Tarefa para Google AI Studio — primeira implementação do Diretor Cinematográfico

Você está trabalhando no repositório existente `bryansouzarodrigues1-creator/animate-stick`, branch `feat/cinematic-scene-director`. Leia primeiro `docs/PRODUCT_DIRECTION.md` e inspecione o código real antes de editar.

## Objetivo desta etapa
Criar uma fundação técnica pequena, segura e testável para que a IA dirija cenas por intenção dramática e beats temporais, em vez de escolher uma ação fixa com base no índice da cena. Não tente resolver todo o realismo nesta etapa.

## Regras obrigatórias
1. Não reescreva o app, não remova funcionalidades existentes e não redesenhe a interface.
2. Preserve o renderer e os formatos existentes. Faça mudanças compatíveis e localizadas.
3. Não adicione Remotion nesta etapa. Primeiro prove a direção de cena e a execução determinística no motor atual.
4. Não invente que ações, IK, física, áudio ou exportação funcionam se o código não demonstrar isso.
5. Não exponha nem grave chaves de API. Use o mecanismo de secrets/backend já existente.
6. Não gere imagens externas ou assets pagos sem explicitar dependências e fallback.
7. Antes de implementar, informe os arquivos que pretende alterar e o motivo. Depois implemente e rode os testes disponíveis.

## Trabalho
A. Audite `src/types/stickman.ts`, `src/types/editor.ts`, `src/utils/choreographyEngine.ts`, `src/utils/stickmanMath.ts`, `src/utils/stickmanRenderer.ts`, `src/components/ScriptDirector.tsx`, `src/components/ScriptSyncModal.tsx` e o fluxo de geração no servidor.

B. Defina um contrato tipado de plano de cena/beat, preferencialmente aditivo e compatível com os tipos atuais. Cada cena deve poder carregar:
- intenção dramática e emoção;
- descrição do ambiente e continuidade;
- enquadramento/movimento de câmera, se suportado pelo renderer;
- beats com tempo relativo, intenção, ação, intensidade, antecipação, reação e pose/estado final;
- variação determinística com seed, sem aleatoriedade a cada frame;
- referências de personagens e objetos.

C. Ajuste a geração por IA para produzir esse plano contextualizado. A resposta deve ser validada em runtime (schema/validação já existente ou validação explícita), com fallback seguro quando o modelo devolver JSON inválido. Não escolher ação apenas por `idx`; a ação deve decorrer do conteúdo e contexto da cena.

D. Faça o motor consumir o novo plano apenas onde houver suporte real. Se uma parte ainda não puder ser executada, preserve os dados e marque a limitação; não finja animação. Garanta que o mesmo timestamp e seed produzam o mesmo estado, independentemente da ordem em que frames são solicitados.

E. Adicione testes unitários para:
- validação do plano e fallback;
- tempos/ordem dos beats;
- determinismo por timestamp + seed;
- duas cenas com mesma ação mas seeds/contextos diferentes gerarem parâmetros de movimento distintos sem quebrar continuidade;
- compatibilidade com cenas antigas sem plano novo.

## Entrega
- Código implementado na branch atual.
- Testes executados e resultado exato.
- Lista dos arquivos alterados.
- Explicação do que agora realmente funciona e do que ainda é só metadado.
- Limitações conhecidas.
- Próxima etapa recomendada.

Se o escopo exigir alteração grande no renderer ou decisões que não possam ser inferidas do código, pare nessa fronteira, explique o bloqueio e proponha a menor prova de conceito. Não faça uma reescrita especulativa.
