# Direção do produto — StickStory Studio

## Objetivo
Transformar o StickStory Studio em uma ferramenta de criação de cenas animadas prontas, não em um editor complexo. A experiência principal deve ser: descrever uma história ou colar um roteiro, gerar uma sequência cinematográfica, opcionalmente adicionar narração e exportar o vídeo.

## Identidade visual
- Personagens stick figure estilizados, consistentes e reconhecíveis.
- Atuação corporal convincente e humana: peso, equilíbrio, intenção, antecipação, reação, respiração, olhar, contato e recuperação.
- Cenários cinematográficos detalhados e realistas, com perspectiva, profundidade, iluminação, atmosfera e objetos coerentes.
- O contraste entre personagem estilizado e ambiente realista é intencional.

## Experiência do usuário
- Fluxo principal simples: ideia/roteiro → gerar cenas → pré-visualizar → áudio opcional → exportar.
- Não transformar o produto em um painel cheio de botões, parâmetros ou controles técnicos.
- Edição avançada pode existir escondida como recurso secundário; não deve ser necessária para obter um bom resultado.
- Narração é opcional: ElevenLabs por API, áudio enviado pelo usuário ou vídeo sem narração.
- Não exigir ElevenLabs para gerar a animação.

## Requisitos de direção de cena
A IA deve interpretar o contexto e produzir um plano por cena, não apenas selecionar uma ação pelo índice da cena. Cada plano deve descrever:
- intenção dramática e emoção;
- personagens presentes e continuidade visual;
- ambiente, hora, clima, objetos e iluminação;
- enquadramento, movimento de câmera e composição;
- beats temporais com começo, desenvolvimento e conclusão;
- ações primárias e secundárias;
- antecipação, reação, pausas, transferência de peso e recuperação;
- contatos com chão/objetos e restrições espaciais;
- transição para a cena seguinte.

## Movimento
- Evitar ciclos idênticos repetidos e escolhas determinísticas baseadas somente no índice da cena.
- Reutilizar primitives de movimento apenas como blocos combináveis, com parâmetros contextuais e variação controlada.
- Preservar continuidade de posição, orientação, estado emocional e objetos entre beats e cenas.
- Priorizar movimento determinístico por timestamp para permitir preview e render offline reproduzíveis.
- Não alegar física real ou movimento humano perfeito sem testes visuais que comprovem isso.

## Cenários
- Evoluir de fundos genéricos para composição em camadas, profundidade, perspectiva, iluminação, atmosfera e objetos específicos da história.
- Preservar coerência espacial e continuidade de ambiente entre planos.
- Avaliar geração/uso de imagens de cenário como camadas de fundo, sem tornar isso uma dependência obrigatória para cada quadro.

## Áudio e exportação
- Suportar áudio importado e narração opcional.
- Sincronizar cenas, duração, falas, efeitos e trilha.
- Exportação final deve ser reproduzível e validada; não confundir gravação em tempo real do preview com render final.
- Avaliar render determinístico/offline. Não integrar Remotion nem trocar o motor atual antes de uma prova técnica pequena e mensurável.

## Estratégia de engenharia
1. Preservar o editor e o motor atual enquanto avaliamos capacidades reais.
2. Separar o plano semântico da IA (direção) da execução visual (renderer).
3. Criar um contrato tipado de cena/beat que possa ser validado.
4. Tornar o renderer determinístico por timestamp.
5. Melhorar movimento e cenário em incrementos testáveis.
6. Só então escolher o pipeline de exportação (Remotion, FFmpeg ou outro) com uma prova de conceito.

## Critérios de qualidade
- Duas cenas com a mesma ação devem parecer diferentes quando contexto, emoção, câmera ou ambiente diferirem.
- O movimento deve ter antecipação, ação, reação e assentamento quando fizer sentido.
- Personagens mantêm identidade e proporções entre cenas.
- Pés e mãos não devem atravessar o chão/objetos nos casos cobertos por testes.
- Uma cena pode ser renderizada no mesmo estado a partir do mesmo timestamp, sem depender do histórico de frames.
- Falhas e limitações devem ser reportadas honestamente; sem simular geração concluída.

## Fora de escopo nesta fase
- Reconstruir toda a interface.
- Adicionar dezenas de controles ao usuário.
- Reescrever o renderer inteiro sem prova de necessidade.
- Prometer animação ilimitada ou realismo perfeito.
- Colocar chaves de API no frontend ou versioná-las no Git.
