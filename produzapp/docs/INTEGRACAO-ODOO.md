# Integração com o Odoo

Papel do Odoo: **dono do cadastro** (produto e variantes, lista de materiais, custos) e, no futuro,
dos módulos que a empresa quiser migrar. O produzapp **lê** o cadastro e envia resultados.

## O que o produzapp lê

- Produto e variantes (código, grade 33–48), lista de materiais, custo
- (Futuro) pedidos de venda, se o comercial passar a lançar no Odoo

## O que o produzapp envia (opcional, fase 4)

- Resultado da OP (pares produzidos, datas) para custeio, se a diretoria quiser o custo real no Odoo

## A validar

1. Forma de acesso externo na versão em uso (Odoo 19.4): API externa (JSON-2/RPC), chave de API por usuário,
   permissões do usuário de integração. **Confirmar a versão exata da API com quem administra o servidor.**
2. Isolamento por empresa: o Odoo filtra por empresa ativa da sessão; o usuário de integração precisa de
   acesso às empresas de Itanhandu e Guaxupé, e as consultas devem declarar as empresas permitidas
   (problema já visto no piloto: ordens de outra empresa ficam invisíveis).
3. Cadastro ainda aberto no Odoo (impacta a leitura): prefixo ST indefinido; variantes do 40501 ST sem código;
   ST45501 sem grade; roteiros e listas de materiais incompletos em várias referências.

## Regras

- O produzapp **nunca grava cadastro** no Odoo.
- Um único usuário de integração, com permissão mínima e chave própria (somente no servidor).
- Falha do Odoo não interrompe a produção: leituras seguem e a sincronização reenvia depois.

## Implementação (fase 4)

- `src/integracoes/odoo.ts` implementando `Destino` (envio) e um leitor de cadastro (`CadastroOdoo`) com cache.
