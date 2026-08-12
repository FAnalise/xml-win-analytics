# Price Insights Hub

Crie um sistema web moderno chamado "Price Analytics".

Objetivo:

Analisar a lucratividade das vendas importadas das notas fiscais XML do Tiny/Olist.

O sistema deve possuir:

1. Login de usuários.

2. Dashboard inicial com cartões mostrando:

- Faturamento

- Lucro Bruto

- Markup Médio

- Quantidade de Produtos Vendidos

- Ticket Médio

3. Menu lateral com:

- Dashboard

- Importar XML

- Produtos

- Vendas

- Relatórios

- Configurações

4. Tela "Importar XML":

- Upload de um ou vários arquivos XML de NFe.

- Mostrar progresso da importação.

- Salvar automaticamente os dados das notas.

5. Tela "Produtos":

Campos:

- SKU

- Produto

- Custo Unitário (editável)

- Última atualização

6. Tela "Vendas":

Mostrar em tabela:

- Número da Nota

- Data

- Produto

- Quantidade

- Valor Unitário

- Valor Total

- Cliente

- Vendedor

- Plataforma

- Custo Unitário

- Custo Total

- Lucro

- Markup

Permitir filtros por:

- Data

- Produto

- Vendedor

- Plataforma

7. Dashboard com gráficos:

- Faturamento por mês

- Lucro por mês

- Vendas por plataforma

- Ranking de vendedores

- Produtos mais vendidos

- Produtos com maior lucro

Utilizar um layout moderno em tons escuros, semelhante ao Tiny ERP, responsivo para desktop e celular.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://xml-win-analytics.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e34eb815-7c48-4e4c-a09a-5779b0e67ff7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
