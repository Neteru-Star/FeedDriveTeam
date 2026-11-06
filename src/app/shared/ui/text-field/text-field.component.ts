import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { ReactiveFormsModule, type FormControl } from '@angular/forms';
import { IonInput } from '@ionic/angular/ion-input';
import { IonInputPasswordToggle } from '@ionic/angular/ion-input-password-toggle';
import type { AutocompleteTypes, TextFieldTypes } from '@ionic/core';
import { fieldErrorMessage } from '@shared/forms/field-errors';

type InputMode = 'text' | 'email' | 'tel' | 'numeric' | 'decimal' | 'url' | 'search' | 'none';

/**
 * Campo de formulario con etiqueta y mensaje de error debajo.
 * El error aparece cuando el control está inválido y tocado; con type="password" agrega el botón para mostrarla.
 */
@Component({
  selector: 'app-text-field',
  imports: [ReactiveFormsModule, IonInput, IonInputPasswordToggle],
  template: `
    <ion-input
      [formControl]="control()"
      [label]="label()"
      labelPlacement="stacked"
      fill="solid"
      [type]="type()"
      [autocomplete]="autocomplete()"
      [inputmode]="inputmode()"
      [placeholder]="placeholder()"
      [helperText]="helper()"
      [errorText]="errorText()"
    >
      @if (type() === 'password') {
        <ion-input-password-toggle slot="end" color="dark" />
      }
    </ion-input>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextFieldComponent {
  readonly control = input.required<FormControl>();
  readonly label = input.required<string>();
  readonly type = input<TextFieldTypes>('text');
  readonly autocomplete = input<AutocompleteTypes>('off');
  readonly inputmode = input<InputMode>();
  readonly placeholder = input<string>();
  readonly helper = input<string>();

  // Los errores del control no son signals: cada evento del control (valor, estado, touched) refresca el mensaje.
  private readonly controlEvents = signal(0);
  protected readonly errorText = computed(() => {
    this.controlEvents();
    return fieldErrorMessage(this.control().errors);
  });

  constructor() {
    effect((onCleanup) => {
      const sub = this.control().events.subscribe(() => this.controlEvents.update((n) => n + 1));
      onCleanup(() => sub.unsubscribe());
    });
  }
}
