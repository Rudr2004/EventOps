import { writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

/**
 * Generates the OpenAPI document without binding a port, so it can run in
 * CI or as a local `npm run export:openapi` and be committed as a static
 * artifact (../docs/openapi.json, at the repo root) for reviewers who want
 * the API contract without running the server first.
 */
async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('EventOps Intelligence Platform API')
    .setDescription('Internal event-operations platform API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  writeFileSync('../docs/openapi.json', JSON.stringify(document, null, 2));

  await app.close();
}

await main();
