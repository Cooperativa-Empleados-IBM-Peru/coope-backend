import {inject} from '@loopback/core';
import {
  del,
  get,
  HttpErrors,
  param,
  post,
  put,
  requestBody,
  RequestBodyObject,
  ResponsesObject,
} from '@loopback/rest';
import {CLOUDANT_CLIENT, CloudantClient} from '../services/cloudant.service';

export const CLOUDANT_DATABASES = new Set([
  'servicios',
  'imagenes',
  'prestamos',
  'certificados',
  'proveedores',
  'categorias',
  'coopeproveedor',
]);

const ANY_OBJECT: Partial<RequestBodyObject> = {
  required: true,
  content: {
    'application/json': {
      schema: {type: 'object', additionalProperties: true},
    },
  },
};

const JSON_RESPONSE: ResponsesObject = {
  '200': {
    description: 'Cloudant response',
    content: {'application/json': {schema: {type: 'object'}}},
  },
};

// Cloudant document ids and revisions: no path separators, no design/_local ids
const DOC_ID = /^[^/\\_][^/\\]{0,254}$/;
const REV = /^[0-9]+-[0-9a-f]{32}$/;

/**
 * Cloudant access for the UI. The browser/Express server never holds Cloudant
 * credentials; they live only in this service.
 */
export class CloudantController {
  constructor(@inject(CLOUDANT_CLIENT) private cloudant: CloudantClient) {}

  @get('/cloudant/{db}/_all_docs', {responses: JSON_RESPONSE})
  async allDocs(
    @param.path.string('db') db: string,
    @param.query.boolean('include_docs') includeDocs?: boolean,
  ): Promise<unknown> {
    return this.cloudant.request({
      method: 'GET',
      segments: [this.database(db), '_all_docs'],
      query: includeDocs ? {include_docs: 'true'} : {},
    });
  }

  @post('/cloudant/{db}/_find', {responses: JSON_RESPONSE})
  async find(
    @param.path.string('db') db: string,
    @requestBody(ANY_OBJECT) query: object,
  ): Promise<unknown> {
    return this.cloudant.request({
      method: 'POST',
      segments: [this.database(db), '_find'],
      body: query,
    });
  }

  @get('/cloudant/{db}/{id}', {responses: JSON_RESPONSE})
  async findById(
    @param.path.string('db') db: string,
    @param.path.string('id') id: string,
  ): Promise<unknown> {
    return this.cloudant.request({
      method: 'GET',
      segments: [this.database(db), this.docId(id)],
    });
  }

  @post('/cloudant/{db}', {responses: JSON_RESPONSE})
  async create(
    @param.path.string('db') db: string,
    @requestBody(ANY_OBJECT) doc: object,
  ): Promise<unknown> {
    return this.cloudant.request({
      method: 'POST',
      segments: [this.database(db)],
      body: doc,
    });
  }

  @put('/cloudant/{db}/{id}', {responses: JSON_RESPONSE})
  async replace(
    @param.path.string('db') db: string,
    @param.path.string('id') id: string,
    @requestBody(ANY_OBJECT) doc: object,
  ): Promise<unknown> {
    return this.cloudant.request({
      method: 'PUT',
      segments: [this.database(db), this.docId(id)],
      body: doc,
    });
  }

  @del('/cloudant/{db}/{id}', {responses: JSON_RESPONSE})
  async remove(
    @param.path.string('db') db: string,
    @param.path.string('id') id: string,
    @param.query.string('rev') rev: string,
  ): Promise<unknown> {
    if (!REV.test(rev ?? '')) {
      throw new HttpErrors.BadRequest('Invalid rev');
    }
    return this.cloudant.request({
      method: 'DELETE',
      segments: [this.database(db), this.docId(id)],
      query: {rev},
    });
  }

  private database(db: string): string {
    if (!CLOUDANT_DATABASES.has(db)) {
      throw new HttpErrors.NotFound('Not found');
    }
    return db;
  }

  private docId(id: string): string {
    if (!DOC_ID.test(id)) {
      throw new HttpErrors.NotFound('Not found');
    }
    return id;
  }
}
