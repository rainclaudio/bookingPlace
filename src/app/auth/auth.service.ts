import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, from } from 'rxjs';
import { count, map, tap } from 'rxjs/operators';
import { Plugins } from '@capacitor/core';
import { environment } from 'src/environments/environment';
import { User } from './user.model';
export interface AuthResponseData {
  kind: string;
  idToken: string;
  email: string;
  refreshToken: string;
  localId: string;
  expiresIn: string;
  registered?: boolean;
  // registered is optional
}
@Injectable({
  providedIn: 'root',
})
/*

` alt 96
*/
export class AuthService implements OnDestroy {
  private _user = new BehaviorSubject<User>(null);
  private activeLogoutTimer: any;
  get token(){
    return this._user.asObservable().pipe(
      map((user) => {
        if (user) {
          console.log("tenemos token en auth service!");
          return user.token;
        } else {
          return null;
        }
      })
    );
  }
  constructor(private http: HttpClient) {}

  autoLogin() {
    return from(
      Plugins.Storage.get({
        key: 'authData',
      })
    ).pipe(
      map((storedData) => {
        if (!storedData || !storedData.value) {
          return null;
        }
        const parsedData = JSON.parse(storedData.value) as {
          token: string;
          tokenExpirationDate: string;
          userId: string;
          email: string;
        };
        const expirationTime = new Date(parsedData.tokenExpirationDate);
        if (expirationTime <= new Date()) {
          return null;
        }
        const user = new User(
          parsedData.userId,
          parsedData.email,
          parsedData.token,
          expirationTime
        );
        return user;
      }),
      tap(user => {
        if(user ){
          this._user.next(user);
          this.autoLogout(user.tokenDuration);
        }

      }),
      map(user => {
        return !!user;
      })
    );
  }
  signup(email: string, password: string) {
    return this.http
      .post<AuthResponseData>(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${environment.firebaseAPIKey}`,
        { email: email, password: password, returnSecureToken: true }
      )
      .pipe(tap(this.setUserData.bind(this)));
  }

  get getuserIsAuthenticated() {
    return this._user.asObservable().pipe(
      map((user) => {
        if (user) {
          return !!user.token;
        } else {
          return false;
        }
      })
    );
  }
  login(email: string, password: string) {
    return this.http
      .post<AuthResponseData>(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${environment.firebaseAPIKey}`,
        { email: email, password: password, returnSecureToken: true }
      )
      .pipe(tap(this.setUserData.bind(this)));
  }
  logout() {
    if(this.activeLogoutTimer){
      clearTimeout(this.activeLogoutTimer);

    }
    this._user.next(null);
    Plugins.Storage.remove({key: 'authData'})
  }


  ngOnDestroy(){
    if(this.activeLogoutTimer){
      clearTimeout(this.activeLogoutTimer);

    }
  }
  private autoLogout(duration: number){
    if(this.activeLogoutTimer){
      clearTimeout(this.activeLogoutTimer);

    }
    this.activeLogoutTimer = setTimeout(() => {
      this.logout();

    },duration);

  }
  get userId() {
    return this._user.asObservable().pipe(
      map((user) => {
        if (user) {
          return user.id;
        } else {
          return null;
        }
      })
    );
  }
  private setUserData(userData: AuthResponseData) {
    const expirationTime = new Date(
      new Date().getTime() + +userData.expiresIn * 1000
    );
    console.log("setUserDataFunction");
    console.table(userData);
      const user = new User(
        userData.localId,
        userData.email,
        userData.idToken,
        expirationTime
      )
     this._user.next(user);
    this.autoLogout(user.tokenDuration);
    this.storeAuthData(
      userData.localId,
      userData.idToken,
      expirationTime.toISOString(),
      userData.email
    );
  }
  onLoginFunction() {}
  private storeAuthData(
    userId: string,
    token: string,
    tokenExpirationDate: string,
    email: string
  ) {
    const data = JSON.stringify({
      userId: userId,
      token: token,
      tokenExpirationDate: tokenExpirationDate,
      email: email,
    });
    Plugins.Storage.set({ key: 'authData', value: data });
  }
}
