import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();
    controller = moduleRef.get(HealthController);
  });

  it('returns an ok health payload', () => {
    const res = controller.check();
    expect(res.status).toBe('ok');
    expect(res.service).toBe('sensei-api');
    expect(typeof res.timestamp).toBe('string');
  });
});
