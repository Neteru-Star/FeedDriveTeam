import { TestBed } from '@angular/core/testing';
import { ToastController } from '@ionic/angular/toast-controller';

import { ToastService } from './toast.service';

describe('ToastService', () => {
  it('styles errors and keeps them longer on screen', async () => {
    const present = vi.fn();
    const create = vi.fn().mockResolvedValue({ present });
    TestBed.configureTestingModule({ providers: [{ provide: ToastController, useValue: { create } }] });

    await TestBed.inject(ToastService).error('Correo o contraseña incorrectos');

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Correo o contraseña incorrectos',
        cssClass: ['app-toast', 'app-toast--error'],
        duration: 4500,
      }),
    );
    expect(present).toHaveBeenCalled();
  });
});
