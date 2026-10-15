# HanapGanap
a web-based system that can be used to catalogue college events in the Philippines.



FOR THE BACKEND 

## Getting Started

Follow these instructions to set up and run HanapGanap locally.

### Prerequisites

Make sure you have installed the following:

- [Node.js](https://nodejs.org/)
- [Git](https://git-scm.com/)
- [PostgreSQL](https://www.postgresql.org/)

### 1. Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd HanapGanap/backend
```

Replace `<YOUR_REPOSITORY_URL>` with the URL of your GitHub repository.

### 2. Install dependencies

Install the required packages (VERY IMPOTANT):

```bash
npm install
#to download ALL the dependencies that are described in the package.json

OR

# to download all the dependencies manually 
npm install express
npm install bcryptjs
npm install jsonwebtoken
npm install -D prisma@7.10.0
npm install @prisma/client@7.10.0 @prisma/adapter-pg pg
```
After downloadeding all the dependencies
Then verify the installed version:

```bash
npm jsonwebtoken --version
npm express --version
npm bcryptjs --version
npx prisma --version
```
### 3. Configure environment variables

Create a `.env` file in the `backend` directory.

Add your PostgreSQL connection string and any other environment variables required by the application.

```bash
PORT=8000
DATABASE_URL="postgresql://USERNAME:PASSWORD@localhost:5432/DATABASE_NAME?schema=public"
```

Replace the placeholders with your local PostgreSQL credentials and database name.

**Important:** Never commit your `.env` file or expose your database credentials. Use `.env.example` to document the required environment variables.

### 4. Initialize Prisma (first-time setup only)

If the repository does not already contain a Prisma schema and configuration, initialize Prisma:

```bash
npx prisma init --datasource-provider postgresql
```

If the repository already includes `prisma/schema.prisma`, a Prisma configuration file, or migration files, do not initialize Prisma again.

### 5. Configure the Prisma schema

Define your database models in `prisma/schema.prisma` and ensure your Prisma configuration points to the correct schema and migrations directory.

For Prisma 7, configure the PostgreSQL datasource URL in your Prisma configuration file and use the PostgreSQL driver adapter in your application.

### 6. Set up the database

Make sure your PostgreSQL server is running and the database specified in `DATABASE_URL` exists.

If the project already includes migration files, apply them using:

```bash
npx prisma migrate deploy
```

If you are creating the initial schema for a new development database and no migration exists yet, create the initial migration using:

```bash
npx prisma migrate dev --name init
```

Do not run both commands blindly. Use the command appropriate to the state of the project.

### 7. Generate Prisma Client

Generate the Prisma Client required by the application:

```bash
npx prisma generate
```

### 8. Start the development server

Run the development script:

```bash
npm run dev
```

The server uses Node.js watch mode and loads environment variables from `.env`. Check the terminal output for the server address and port.

### 9. Test the API

Use Postman or another API client to test the available endpoints. Refer to the project's API documentation for supported routes and request formats.

### Troubleshooting

- **Missing dependencies:** Run `npm install`.
- **Prisma schema not found:** Verify the schema path in your Prisma configuration.
- **Database connection errors:** Check that PostgreSQL is running and `DATABASE_URL` is correct.
- **Missing Prisma Client:** Run `npx prisma generate`.
- **Missing database tables:** Confirm that the appropriate migrations have been applied.

AS FOR THE DOCKER uh di ko pa gets as of this push