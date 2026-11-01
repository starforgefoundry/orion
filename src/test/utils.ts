import { BaseRepository } from '$lib/server/repositories/base.repository';
import type { SettingsMap, SettingsRepository } from '$lib/server/repositories/settings.repository';
import {
  REPOSITORIES,
  type BaseService,
  type ServiceRepositories,
} from '$lib/server/services/base.service';
import { vi, type Mocked } from 'vitest';

type Constructor<T> = abstract new (...args: never[]) => T;

export type ServiceMocks = { [K in keyof ServiceRepositories]: Mocked<ServiceRepositories[K]> };

function methodNames(Dependency: Constructor<unknown>) {
  const names = new Set<string>();
  for (
    let prototype = Dependency.prototype;
    prototype && prototype !== BaseRepository.prototype && prototype !== Object.prototype;
    prototype = Object.getPrototypeOf(prototype)
  ) {
    for (const name of Object.getOwnPropertyNames(prototype)) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
      if (name !== 'constructor' && typeof descriptor?.value === 'function') {
        names.add(name);
      }
    }
  }
  return names;
}

function unimplemented(label: string) {
  return vi.fn(() => {
    throw new Error(`${label} was called without a mock implementation`);
  });
}

/**
 * Mocks every method of a class. With `strict` (the default) a method throws until the test
 * gives it an implementation, so an unexpected call fails instead of returning undefined.
 */
export function automock<T>(Dependency: Constructor<T>, { strict = true } = {}): Mocked<T> {
  const mock: Record<string, unknown> = {};
  for (const name of methodNames(Dependency)) {
    mock[name] = strict ? unimplemented(`${Dependency.name}.${name}`) : vi.fn();
  }
  return mock as Mocked<T>;
}

export function newServiceMocks(): ServiceMocks {
  const entries = Object.entries(REPOSITORIES).map(([key, Repository]) => [
    key,
    automock(Repository as Constructor<unknown>),
  ]);
  return Object.fromEntries(entries) as ServiceMocks;
}

export function newTestService<T extends BaseService>(
  Service: new (repositories: Partial<ServiceRepositories>) => T,
) {
  const mocks = newServiceMocks();
  const sut = new Service(mocks as unknown as ServiceRepositories);
  return { sut, mocks };
}

export function stubSettings(
  settingsRepository: Mocked<SettingsRepository>,
  settings: Partial<SettingsMap>,
) {
  settingsRepository.getSetting.mockImplementation(async <K extends keyof SettingsMap>(key: K) => {
    const setting = settings[key];
    if (!setting) {
      throw new Error(`Setting "${key}" was read without a stub`);
    }
    return setting as SettingsMap[K];
  });
}
