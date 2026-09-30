'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { Address } from '@/lib/types';
import { isValidEmail, isValidPincode, normaliseIndianPhone } from '@/lib/utils';

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

export interface AddressFormValues {
  email: string;
  address: Address;
}

interface AddressFormProps {
  initialValues?: Partial<AddressFormValues>;
  onSubmit: (values: AddressFormValues) => void;
  submitLabel?: string;
}

type FieldName = 'email' | 'name' | 'phone' | 'line1' | 'line2' | 'city' | 'state' | 'pincode';
type Errors = Partial<Record<FieldName, string>>;

const FIELD_ORDER: FieldName[] = ['email', 'name', 'phone', 'line1', 'city', 'state', 'pincode'];

export function AddressForm({ initialValues, onSubmit, submitLabel = 'Continue to Payment' }: AddressFormProps) {
  const initial = initialValues?.address;
  const [values, setValues] = useState<Record<FieldName, string>>({
    email: initialValues?.email ?? '',
    name: initial?.name ?? '',
    phone: initial?.phone ?? '',
    line1: initial?.line1 ?? '',
    line2: initial?.line2 ?? '',
    city: initial?.city ?? '',
    state: initial?.state ?? '',
    pincode: initial?.pincode ?? '',
  });
  const [errors, setErrors] = useState<Errors>({});

  const update = (field: FieldName) => (event: { target: { value: string } }) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (!isValidEmail(values.email)) next.email = 'Please enter a valid email address.';
    if (values.name.trim().length < 2) next.name = 'Please enter your full name.';
    if (!normaliseIndianPhone(values.phone)) next.phone = 'Please enter a valid 10-digit mobile number.';
    if (!values.line1.trim()) next.line1 = 'Please enter your address.';
    if (!values.city.trim()) next.city = 'Please enter your city.';
    if (!values.state) next.state = 'Please select your state.';
    if (!isValidPincode(values.pincode)) next.pincode = 'Please enter a valid 6-digit pincode.';
    return next;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);

    const firstError = FIELD_ORDER.find((field) => nextErrors[field]);
    if (firstError) {
      document.getElementById(`address-${firstError}`)?.focus();
      return;
    }

    onSubmit({
      email: values.email.trim().toLowerCase(),
      address: {
        name: values.name.trim(),
        phone: normaliseIndianPhone(values.phone) ?? values.phone,
        line1: values.line1.trim(),
        line2: values.line2.trim() || undefined,
        city: values.city.trim(),
        state: values.state,
        pincode: values.pincode.trim(),
        country: 'India',
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <Input
        id="address-email"
        label="Email"
        type="email"
        autoComplete="email"
        value={values.email}
        onChange={update('email')}
        error={errors.email}
        hint="We'll send your order confirmation here."
        required
      />
      <Input
        id="address-name"
        label="Full name"
        autoComplete="name"
        value={values.name}
        onChange={update('name')}
        error={errors.name}
        required
      />
      <Input
        id="address-phone"
        label="Phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="10-digit mobile number"
        value={values.phone}
        onChange={update('phone')}
        error={errors.phone}
        required
      />
      <Input
        id="address-line1"
        label="Address line 1"
        autoComplete="address-line1"
        placeholder="House / flat no., building, street"
        value={values.line1}
        onChange={update('line1')}
        error={errors.line1}
        required
      />
      <Input
        id="address-line2"
        label="Address line 2"
        optional
        autoComplete="address-line2"
        placeholder="Area, landmark"
        value={values.line2}
        onChange={update('line2')}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          id="address-city"
          label="City"
          autoComplete="address-level2"
          value={values.city}
          onChange={update('city')}
          error={errors.city}
          required
        />
        <Input
          id="address-pincode"
          label="Pincode"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          value={values.pincode}
          onChange={update('pincode')}
          error={errors.pincode}
          required
        />
      </div>
      <Select
        id="address-state"
        label="State"
        autoComplete="address-level1"
        placeholder="Select state"
        options={INDIAN_STATES.map((state) => ({ value: state, label: state }))}
        value={values.state}
        onChange={update('state')}
        error={errors.state}
        required
      />
      <Button type="submit" variant="secondary" size="lg" width="full">
        {submitLabel}
      </Button>
    </form>
  );
}

export default AddressForm;
